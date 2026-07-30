import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as TagController from "../controllers/TagController";

const tagRoutes = express.Router();

tagRoutes.get("/tags",           isAuth, requiresCompany, hasPermission("tags:view"),   TagController.index);
tagRoutes.post("/tags",          isAuth, requiresCompany, hasPermission("tags:create"), TagController.store);
tagRoutes.put("/tags/:tagId",    isAuth, requiresCompany, hasPermission("tags:edit"),   TagController.update);
tagRoutes.delete("/tags/:tagId", isAuth, requiresCompany, hasPermission("tags:delete"), TagController.remove);

// Aplicar etiquetas em um chat é ação de atendimento, não de administração.
tagRoutes.put(
  "/tickets/:ticketId/tags",
  isAuth,
  requiresCompany,
  hasPermission("tags:assign"),
  TagController.syncTicketTags
);

export default tagRoutes;
