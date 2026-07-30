import { Request, Response } from "express";

import getCompanyId from "../helpers/GetCompanyId";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Message from "../models/Message";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import CreateInternalNoteService from "../services/MessageServices/CreateInternalNoteService";
import ForwardMessageService from "../services/MessageServices/ForwardMessageService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";

type IndexQuery = {
  pageNumber: string;
  searchParam?: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber, searchParam } = req.query as IndexQuery;

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
  const { body, quotedMsg }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  const ticket = await ShowTicketService(ticketId, getCompanyId(req));

  SetTicketMessagesAsRead(ticket);

  if (medias) {
    await Promise.all(
      medias.map(async (media: Express.Multer.File) => {
        await SendWhatsAppMedia({ media, ticket });
      })
    );
  } else {
    await SendWhatsAppMessage({ body, ticket, quotedMsg });
  }

  return res.send();
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

  const ticket = await ForwardMessageService({
    messageId,
    toTicketId,
    toContactId,
    userId: Number(req.user.id),
    companyId: getCompanyId(req)
  });

  return res.status(200).json({ ticketId: ticket.id });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;

  const message = await DeleteWhatsAppMessage(messageId, getCompanyId(req));

  const io = getIO();
  io.to(`company-${req.user.companyId}`)
    .to(message.ticketId.toString())
    .emit("appMessage", {
      action: "update",
      message
    });

  return res.send();
};
