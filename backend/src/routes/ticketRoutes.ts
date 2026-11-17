import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as TicketController from "../controllers/TicketController";

const ticketRoutes = express.Router();

ticketRoutes.get("/tickets/tab-rules",    isAuth, requiresCompany, hasPermission("tickets:view"),   TicketController.tabRules);
ticketRoutes.get("/tickets",              isAuth, requiresCompany, hasPermission("tickets:view"),   TicketController.index);
ticketRoutes.get("/tickets/:ticketId",    isAuth, requiresCompany, hasPermission("tickets:view"),   TicketController.show);
ticketRoutes.post("/tickets",             isAuth, requiresCompany, hasPermission("tickets:create"), TicketController.store);
// Ler é o que a rota faz; por isso "tickets:view" e não "tickets:edit".
ticketRoutes.post("/tickets/:ticketId/read", isAuth, requiresCompany, hasPermission("tickets:view"), TicketController.markAsRead);
ticketRoutes.put("/tickets/:ticketId",    isAuth, requiresCompany, hasPermission("tickets:edit"),   TicketController.update);
ticketRoutes.delete("/tickets/:ticketId", isAuth, requiresCompany, hasPermission("tickets:delete"), TicketController.remove);

export default ticketRoutes;
