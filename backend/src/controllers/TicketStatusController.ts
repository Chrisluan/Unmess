import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import getCompanyId from "../helpers/GetCompanyId";

import ListTicketStatusesService from "../services/TicketStatusServices/ListTicketStatusesService";
import CreateTicketStatusService from "../services/TicketStatusServices/CreateTicketStatusService";
import UpdateTicketStatusService from "../services/TicketStatusServices/UpdateTicketStatusService";
import DeleteTicketStatusService from "../services/TicketStatusServices/DeleteTicketStatusService";
import { comConsistencia } from "../helpers/consistencia/motor";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const statuses = await ListTicketStatusesService(getCompanyId(req));

  return res.status(200).json(statuses);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color, type, isDefault } = req.body;

  const companyId = getCompanyId(req);
  const status = await comConsistencia(companyId, "statusDeTicket", transaction =>
    CreateTicketStatusService({ name, color, type, isDefault, companyId, transaction })
  );

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

  // Desmarcar o padrão ou mudar o tipo pode deixar o fechamento automático
  // sem motivo; o motor recusa e diz o que falta.
  const companyId = getCompanyId(req);
  const status = await comConsistencia(companyId, "statusDeTicket", transaction =>
    UpdateTicketStatusService({
      id: ticketStatusId,
      name,
      color,
      type,
      isDefault,
      companyId,
      transaction
    })
  );

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

  const companyId = getCompanyId(req);
  await comConsistencia(companyId, "statusDeTicket", transaction =>
    DeleteTicketStatusService(ticketStatusId, companyId, transaction)
  );

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("ticketStatus", {
    action: "delete",
    ticketStatusId
  });

  return res.status(200).json({ message: "Ticket status deleted" });
};
