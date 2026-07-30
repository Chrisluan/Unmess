import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as TicketStatusController from "../controllers/TicketStatusController";

const ticketStatusRoutes = express.Router();

// Leitura liberada para quem atende: é preciso listar os status ao encerrar um chat.
ticketStatusRoutes.get("/ticket-statuses",                    isAuth, requiresCompany, hasPermission("tickets:view"),  TicketStatusController.index);
ticketStatusRoutes.post("/ticket-statuses",                   isAuth, requiresCompany, hasPermission("settings:edit"), TicketStatusController.store);
ticketStatusRoutes.put("/ticket-statuses/:ticketStatusId",    isAuth, requiresCompany, hasPermission("settings:edit"), TicketStatusController.update);
ticketStatusRoutes.delete("/ticket-statuses/:ticketStatusId", isAuth, requiresCompany, hasPermission("settings:edit"), TicketStatusController.remove);

export default ticketStatusRoutes;
