import { Request, Response } from "express";

import getCompanyId from "../helpers/GetCompanyId";
import { garantirAcessoAoTicket, garantirAcessoAoTicketDaMensagem } from "../helpers/permissions/acessoAoTicket";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import { companyRoom, ticketRoom } from "../libs/socketRooms";
import Message from "../models/Message";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import CreateInternalNoteService from "../services/MessageServices/CreateInternalNoteService";
import ForwardMessageService from "../services/MessageServices/ForwardMessageService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import EditWhatsAppMessage from "../services/WbotServices/EditWhatsAppMessage";
import AppError from "../errors/AppError";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import { ProviderMessage } from "../providers/WhatsApp";
import { envioUnico } from "../helpers/DedupeEnvio";
import { logger } from "../utils/logger";

type IndexQuery = {
  pageNumber: string;
  searchParam?: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  /** Identificador gerado pelo navegador, repetido a cada nova tentativa. */
  clientId?: string;
  /** Legenda dos anexos. */
  caption?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber, searchParam } = req.query as IndexQuery;

  await garantirAcessoAoTicket(req, ticketId);

  const { count, messages, ticket, hasMore } = await ListMessagesService({
    pageNumber,
    ticketId,
    searchParam,
    companyId: getCompanyId(req)
  });

  // Busca dentro da conversa não deve marcar tudo como lido: o atendente está
  // consultando o histórico, não necessariamente atendendo.
  if (!searchParam) {
    SetTicketMessagesAsRead(ticket);
  }

  return res.json({ count, messages, ticket, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg, clientId, caption }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
  const companyId = getCompanyId(req);

  await garantirAcessoAoTicket(req, ticketId);

  const ticket = await ShowTicketService(ticketId, companyId);

  SetTicketMessagesAsRead(ticket);

  // A chave vem do navegador e se repete a cada tentativa da mesma mensagem.
  // É o que permite reenviar depois de uma falha de rede sem o contato
  // receber duas vezes: se a primeira chamada chegou a sair, a segunda
  // devolve o resultado dela em vez de mandar de novo.
  const chave = clientId ? `${companyId}:${ticketId}:${clientId}` : undefined;

  const enviadas = await envioUnico(chave, async () => {
    if (medias && medias.length > 0) {
      const resultados: ProviderMessage[] = [];

      // Em sequência, e não em paralelo: o WhatsApp entrega na ordem em que
      // recebe, e disparar tudo de uma vez embaralhava os anexos de um mesmo
      // envio na conversa do cliente.
      //
      // A legenda acompanha só o primeiro anexo, como no próprio WhatsApp —
      // repeti-la em cada arquivo encheria a conversa do mesmo texto.
      for (let i = 0; i < medias.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const enviada = await SendWhatsAppMedia({
          media: medias[i],
          ticket,
          body: i === 0 && caption?.trim() ? caption.trim() : undefined
        });
        resultados.push(enviada);
      }

      return resultados;
    }

    return [await SendWhatsAppMessage({ body, ticket, quotedMsg })];
  });

  // O envio deixa rastro nos dois sentidos: o erro sai em SendWhatsApp*, e o
  // sucesso aqui, com o id que o WhatsApp devolveu. É por esse id que se
  // acompanha depois a confirmação de entrega nos logs.
  logger.info(
    {
      ticketId: ticket.id,
      userId: req.user?.id,
      whatsappId: ticket.whatsappId,
      messageIds: enviadas.map(m => m.id),
      anexos: medias?.length || 0
    },
    "Mensagem enviada ao WhatsApp"
  );

  // Devolve o que foi criado: a tela precisa do id para casar a mensagem
  // otimista que já mostrou com a que vai chegar pelo socket, e do ack para
  // saber se ainda está saindo ou se o servidor já confirmou.
  return res.status(200).json({
    messages: enviadas.map(m => ({ id: m.id, ack: m.ack ?? 0 }))
  });
};

/**
 * Nota interna — não sai para o WhatsApp.
 */
export const storeInternalNote = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { body } = req.body;

  await garantirAcessoAoTicket(req, ticketId);

  const message = await CreateInternalNoteService({
    ticketId,
    body,
    userId: Number(req.user.id),
    companyId: getCompanyId(req)
  });

  return res.status(200).json(message);
};

/**
 * Encaminha uma mensagem para outro chat ou contato.
 */
export const forward = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { toTicketId, toContactId } = req.body;

  await garantirAcessoAoTicketDaMensagem(req, messageId);
  if (toTicketId) await garantirAcessoAoTicket(req, toTicketId);

  const ticket = await ForwardMessageService({
    messageId,
    toTicketId,
    toContactId,
    userId: Number(req.user.id),
    companyId: getCompanyId(req)
  });

  return res.status(200).json({ ticketId: ticket.id });
};

export const edit = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { body } = req.body as { body: string };

  await garantirAcessoAoTicketDaMensagem(req, messageId);

  if (!body || !body.trim()) {
    throw new AppError("ERR_EDIT_EMPTY_BODY");
  }

  const message = await EditWhatsAppMessage(
    messageId,
    body.trim(),
    getCompanyId(req)
  );

  const io = getIO();
  io.to(companyRoom(getCompanyId(req)))
    .to(ticketRoom(getCompanyId(req), message.ticketId))
    .emit("appMessage", {
      action: "update",
      message
    });

  return res.status(200).json(message);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;

  await garantirAcessoAoTicketDaMensagem(req, messageId);

  const message = await DeleteWhatsAppMessage(messageId, getCompanyId(req));

  const io = getIO();
  io.to(companyRoom(getCompanyId(req)))
    .to(ticketRoom(getCompanyId(req), message.ticketId))
    .emit("appMessage", {
      action: "update",
      message
    });

  return res.send();
};
