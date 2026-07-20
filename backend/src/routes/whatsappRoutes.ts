import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import * as WhatsAppController from "../controllers/WhatsAppController";

const whatsappRoutes = express.Router();

whatsappRoutes.get("/whatsapp/",                isAuth, requiresCompany, WhatsAppController.index);
whatsappRoutes.post("/whatsapp/",               isAuth, requiresCompany, WhatsAppController.store);
whatsappRoutes.get("/whatsapp/:whatsappId",     isAuth, requiresCompany, WhatsAppController.show);
whatsappRoutes.put("/whatsapp/:whatsappId",     isAuth, requiresCompany, WhatsAppController.update);
whatsappRoutes.delete("/whatsapp/:whatsappId",  isAuth, requiresCompany, WhatsAppController.remove);

export default whatsappRoutes;
