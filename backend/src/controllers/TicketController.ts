import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import {
  companyRoom,
  notificationRoom,
  statusRoom,
  ticketRoom
} from "../libs/socketRooms";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import formatBody from "../helpers/Mustache";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import getCompanyId from "../helpers/GetCompanyId";
import { TAB_RULES } from "../helpers/TicketTabRules";
import { usuarioPode } from "../helpers/permissions/resolve";
import { escopoDaRequisicao } from "../helpers/permissions/escopoDaRequisicao";
import { garantirAcessoAoTicket } from "../helpers/permissions/acessoAoTicket";
import AppError from "../errors/AppError";
import UserQueue from "../models/UserQueue";
import CreateInternalNoteService from "../services/MessageServices/CreateInternalNoteService";
import ListarDestinosDeTransferenciaService from "../services/TicketServices/ListarDestinosDeTransferenciaService";
import { logger } from "../utils/logger";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  tab: string;
  date: string;
  showAll: string;
  withUnreadMessages: string;
  queueIds: string;
  whatsappIds: string;
  tagIds: string;
  userIds: string;
  groups: string;
};

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
  whatsappId?: number;
  removeUser?: boolean;
  removeQueue?: boolean;
}

/**
 * Entrega ao frontend a definição das abas. Sem isso ele precisaria manter uma
 * cópia própria da regra, que foi exatamente o que fez a lista parar de
 * atualizar quando as duas divergiram.
 */
export const tabRules = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  return res.status(200).json(TAB_RULES);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    tab,
    date,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    whatsappIds: whatsappIdsStringified,
    tagIds: tagIdsStringified,
    userIds: userIdsStringified,
    groups,
    withUnreadMessages
  } = req.query as IndexQuery;

  const userId = req.user.id;
  const companyId = getCompanyId(req);

  let queueIds: number[] = [];
  let whatsappIds: number[] = [];
  let tagIds: number[] = [];
  let userIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  // As filas que chegam na query são pedido da tela, não direito da pessoa:
  // sem `tickets:viewAll` elas são cortadas para as filas que ela realmente
  // tem. Antes bastava mandar outros ids na URL para listar as conversas de
  // um setor alheio.
  if (!(await usuarioPode(Number(userId), "tickets:viewAll"))) {
    const minhas = (
      await UserQueue.findAll({
        where: { userId: Number(userId) },
        attributes: ["queueId"]
      })
    ).map(f => f.queueId);

    queueIds = queueIdsStringified
      ? queueIds.filter(id => minhas.includes(Number(id)))
      : minhas;
  }

  if (whatsappIdsStringified) {
    whatsappIds = JSON.parse(whatsappIdsStringified);
  }

  if (tagIdsStringified) {
    tagIds = JSON.parse(tagIdsStringified);
  }

  // Filtrar por atendente é visão de supervisão: só quem pode ver todas as
  // conversas escolhe de quem são. Para os demais o parâmetro é ignorado em
  // silêncio — a lista continua sendo a que eles já teriam.
  if (userIdsStringified) {
    const podeFiltrarPorAtendente = await usuarioPode(
      Number(userId),
      "tickets:viewAll"
    );

    if (podeFiltrarPorAtendente) {
      userIds = JSON.parse(userIdsStringified);
    }
  }

  const { tickets, count, hasMore } = await ListTicketsService({
    escopoDeConexoes: await escopoDaRequisicao(req, "connection"),
    searchParam,
    pageNumber,
    status,
    tab,
    date,
    showAll,
    userId,
    queueIds,
    whatsappIds,
    tagIds,
    userIds,
    groups,
    withUnreadMessages,
    companyId
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, userId, queueId, whatsappId }: TicketData =
    req.body;

  const ticket = await CreateTicketService({
    contactId,
    status,
    userId,
    queueId,
    whatsappId,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  const empresa = getCompanyId(req);

  io.to(companyRoom(empresa))
    .to(statusRoom(empresa, ticket.status))
    .emit("ticket", {
      action: "update",
      ticket
    });

  return res.status(200).json(ticket);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  await garantirAcessoAoTicket(req, ticketId);

  const contact = await ShowTicketService(ticketId, getCompanyId(req));

  return res.status(200).json(contact);
};

/**
 * Zera o contador de não lidas da conversa.
 *
 * Existe porque a marcação de leitura só acontecia ao carregar o histórico
 * (`GET /messages/:ticketId`) ou ao responder. Com o contador funcionando de
 * verdade, a conversa que o atendente já está lendo passaria a acumular
 * "1, 2, 3..." na frente dele até que saísse e voltasse. Esta rota é o
 * caminho barato para dizer "estou olhando isto agora".
 */
export const markAsRead = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;

  await garantirAcessoAoTicket(req, ticketId);

  const ticket = await ShowTicketService(ticketId, getCompanyId(req));

  await SetTicketMessagesAsRead(ticket);

  return res.status(200).json({ ticketId: +ticketId, unreadMessages: 0 });
};

/**
 * Setores e atendentes para onde a conversa pode ser transferida.
 */
export const destinosDeTransferencia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const destinos = await ListarDestinosDeTransferenciaService(
    getCompanyId(req)
  );

  return res.status(200).json(destinos);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;
  const { isTransfer, notaDeTransferencia } = req.body;

  await garantirAcessoAoTicket(req, ticketId);

  /**
   * Transferir é uma permissão separada de responder, e é aqui que ela vale.
   *
   * A rota inteira é guardada por `tickets:edit` — o que basta para quem está
   * respondendo. Passar a conversa para outra pessoa ou outra fila é outra
   * decisão: tira o atendimento das mãos de quem está com ele. A permissão
   * existia no catálogo e aparecia na tela de cargos, mas nada no servidor a
   * conferia: bastava chamar esta rota direto para transferir sem tê-la.
   */
  const estaTransferindo =
    isTransfer === true ||
    ticketData.userId !== undefined ||
    ticketData.queueId !== undefined;

  if (estaTransferindo) {
    const pode = await usuarioPode(Number(req.user.id), "tickets:transfer");
    if (!pode) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  const { ticket } = await UpdateTicketService({
    ticketData,
    ticketId,
    companyId: getCompanyId(req),
    isTransfer,
    atorId: Number(req.user.id)
  });

  /**
   * O recado de quem passa a conversa adiante.
   *
   * Sem ele, quem recebe precisa reler o histórico inteiro para descobrir o
   * que já foi combinado. Vira nota interna: fica na linha do tempo, para a
   * equipe, e nunca vai para o cliente.
   */
  const recado =
    typeof notaDeTransferencia === "string" ? notaDeTransferencia.trim() : "";

  if (estaTransferindo && recado) {
    try {
      await CreateInternalNoteService({
        ticketId: ticket.id,
        body: recado.slice(0, 2000),
        userId: Number(req.user.id),
        companyId: getCompanyId(req)
      });
    } catch (err) {
      // A transferência já aconteceu; perder o recado não pode desfazê-la.
      logger.error("Erro ao gravar o recado da transferência:", err);
    }
  }

  if (ticket.status === "closed") {
    const whatsapp = await ShowWhatsAppService(ticket.whatsappId);

    const { farewellMessage } = whatsapp;

    if (farewellMessage) {
      await SendWhatsAppMessage({
        body: formatBody(farewellMessage, ticket.contact),
        ticket
      });
    }
  }

  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;

  await garantirAcessoAoTicket(req, ticketId);

  const ticket = await DeleteTicketService(ticketId, getCompanyId(req));

  const io = getIO();
  const empresa = getCompanyId(req);

  io.to(companyRoom(empresa))
    .to(statusRoom(empresa, ticket.status))
    .to(ticketRoom(empresa, ticketId))
    .to(notificationRoom(empresa))
    .emit("ticket", {
      action: "delete",
      ticketId: +ticketId
    });

  return res.status(200).json({ message: "ticket deleted" });
};
