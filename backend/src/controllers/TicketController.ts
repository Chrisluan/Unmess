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
import getCompanyId from "../helpers/GetCompanyId";
import { TAB_RULES } from "../helpers/TicketTabRules";
import { userHasPermission } from "../helpers/permissions/GetUserPermissions";

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
    const podeFiltrarPorAtendente = await userHasPermission(
      Number(userId),
      "tickets:viewAll"
    );

    if (podeFiltrarPorAtendente) {
      userIds = JSON.parse(userIdsStringified);
    }
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
