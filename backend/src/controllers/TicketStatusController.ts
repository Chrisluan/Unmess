import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import getCompanyId from "../helpers/GetCompanyId";

import ListTicketStatusesService from "../services/TicketStatusServices/ListTicketStatusesService";
import CreateTicketStatusService from "../services/TicketStatusServices/CreateTicketStatusService";
import UpdateTicketStatusService from "../services/TicketStatusServices/UpdateTicketStatusService";
import DeleteTicketStatusService from "../services/TicketStatusServices/DeleteTicketStatusService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const statuses = await ListTicketStatusesService(getCompanyId(req));

  return res.status(200).json(statuses);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color, type, isDefault } = req.body;

  const status = await CreateTicketStatusService({
    name,
    color,
    type,
    isDefault,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("ticketStatus", {
    action: "create",
    ticketStatus: status
  });

  return res.status(200).json(status);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketStatusId } = req.params;
  const { name, color, type, isDefault } = req.body;

  const status = await UpdateTicketStatusService({
    id: ticketStatusId,
    name,
    color,
    type,
    isDefault,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("ticketStatus", {
    action: "update",
    ticketStatus: status
  });

  return res.status(200).json(status);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketStatusId } = req.params;

  await DeleteTicketStatusService(ticketStatusId, getCompanyId(req));

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("ticketStatus", {
    action: "delete",
    ticketStatusId
  });

  return res.status(200).json({ message: "Ticket status deleted" });
};
