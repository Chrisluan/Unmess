import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import formatBody from "../helpers/Mustache";
import getCompanyId from "../helpers/GetCompanyId";

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
    withUnreadMessages
  } = req.query as IndexQuery;

  const userId = req.user.id;
  const companyId = getCompanyId(req);

  let queueIds: number[] = [];
  let whatsappIds: number[] = [];
  let tagIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  if (whatsappIdsStringified) {
    whatsappIds = JSON.parse(whatsappIdsStringified);
  }

  if (tagIdsStringified) {
    tagIds = JSON.parse(tagIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsService({
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
  io.to(`company-${req.user.companyId}`)
    .to(ticket.status)
    .emit("ticket", {
      action: "update",
      ticket
    });

  return res.status(200).json(ticket);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  const contact = await ShowTicketService(ticketId, getCompanyId(req));

  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;
  const { isTransfer } = req.body;

  const { ticket } = await UpdateTicketService({
    ticketData,
    ticketId,
    companyId: getCompanyId(req),
    isTransfer
  });

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

  const ticket = await DeleteTicketService(ticketId, getCompanyId(req));

  const io = getIO();
  io.to(`company-${req.user.companyId}`)
    .to(ticket.status)
    .to(ticketId)
    .to("notification")
    .emit("ticket", {
      action: "delete",
      ticketId: +ticketId
    });

  return res.status(200).json({ message: "ticket deleted" });
};
