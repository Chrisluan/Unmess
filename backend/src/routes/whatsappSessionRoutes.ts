import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";

import WhatsAppSessionController from "../controllers/WhatsAppSessionController";

const whatsappSessionRoutes = Router();

/**
 * Ligar, religar e derrubar o WhatsApp da empresa.
 *
 * Estas três rotas pediam login e mais nada. Qualquer pessoa com uma sessão
 * aberta — inclusive quem só atendia — podia desconectar o número da empresa e
 * tirar o atendimento inteiro do ar até alguém ler o QR Code de novo. A ação é
 * dessa gravidade, e por isso pede a permissão mais alta do módulo.
 */
whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId",
  isAuth,
  requiresCompany,
  hasPermission("connections:session"),
  WhatsAppSessionController.store
);

whatsappSessionRoutes.put(
  "/whatsappsession/:whatsappId",
  isAuth,
  requiresCompany,
  hasPermission("connections:session"),
  WhatsAppSessionController.update
);

whatsappSessionRoutes.delete(
  "/whatsappsession/:whatsappId",
  isAuth,
  requiresCompany,
  hasPermission("connections:session"),
  WhatsAppSessionController.remove
);

export default whatsappSessionRoutes;
