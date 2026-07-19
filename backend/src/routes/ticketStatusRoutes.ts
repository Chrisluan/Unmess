import express from "express";
import isAuth from "../middleware/isAuth";

import * as TicketStatusController from "../controllers/TicketStatusController";

const ticketStatusRoutes = express.Router();

ticketStatusRoutes.get("/ticket-statuses", isAuth, TicketStatusController.index);
ticketStatusRoutes.post("/ticket-statuses", isAuth, TicketStatusController.store);
ticketStatusRoutes.put(
  "/ticket-statuses/:ticketStatusId",
  isAuth,
  TicketStatusController.update
);
ticketStatusRoutes.delete(
  "/ticket-statuses/:ticketStatusId",
  isAuth,
  TicketStatusController.remove
);

export default ticketStatusRoutes;
