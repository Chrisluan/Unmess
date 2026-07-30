import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import uploadConfig from "../config/upload";

import * as MessageController from "../controllers/MessageController";

const messageRoutes = Router();

const upload = multer(uploadConfig);

messageRoutes.get(
  "/messages/:ticketId",
  isAuth,
  requiresCompany,
  hasPermission("tickets:view"),
  MessageController.index
);

messageRoutes.post(
  "/messages/:ticketId",
  isAuth,
  requiresCompany,
  hasPermission("tickets:edit"),
  upload.array("medias"),
  MessageController.store
);

// Nota interna: fica visível só para a equipe, não é enviada ao contato.
messageRoutes.post(
  "/messages/:ticketId/notes",
  isAuth,
  requiresCompany,
  hasPermission("tickets:edit"),
  MessageController.storeInternalNote
);

// Encaminhar mensagem para outro chat/contato.
messageRoutes.post(
  "/messages/:messageId/forward",
  isAuth,
  requiresCompany,
  hasPermission("tickets:edit"),
  MessageController.forward
);

messageRoutes.delete(
  "/messages/:messageId",
  isAuth,
  requiresCompany,
  hasPermission("tickets:edit"),
  MessageController.remove
);

export default messageRoutes;
