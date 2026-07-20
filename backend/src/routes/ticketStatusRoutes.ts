import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import * as TicketStatusController from "../controllers/TicketStatusController";

const ticketStatusRoutes = express.Router();

ticketStatusRoutes.get("/ticket-statuses",                    isAuth, requiresCompany, TicketStatusController.index);
ticketStatusRoutes.post("/ticket-statuses",                   isAuth, requiresCompany, TicketStatusController.store);
ticketStatusRoutes.put("/ticket-statuses/:ticketStatusId",    isAuth, requiresCompany, TicketStatusController.update);
ticketStatusRoutes.delete("/ticket-statuses/:ticketStatusId", isAuth, requiresCompany, TicketStatusController.remove);

export default ticketStatusRoutes;
