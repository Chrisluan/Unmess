import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as WhatsAppController from "../controllers/WhatsAppController";

const whatsappRoutes = express.Router();

whatsappRoutes.get("/whatsapp/",               isAuth, requiresCompany, hasPermission("connections:view"),   WhatsAppController.index);
whatsappRoutes.post("/whatsapp/",              isAuth, requiresCompany, hasPermission("connections:create"), WhatsAppController.store);
whatsappRoutes.get("/whatsapp/:whatsappId",    isAuth, requiresCompany, hasPermission("connections:view"),   WhatsAppController.show);
whatsappRoutes.put("/whatsapp/:whatsappId",    isAuth, requiresCompany, hasPermission("connections:edit"),   WhatsAppController.update);
whatsappRoutes.delete("/whatsapp/:whatsappId", isAuth, requiresCompany, hasPermission("connections:delete"), WhatsAppController.remove);

export default whatsappRoutes;
