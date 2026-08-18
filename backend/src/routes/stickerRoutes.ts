import { Router } from "express";
import multer from "multer";

import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import uploadConfig from "../config/upload";
import * as StickerController from "../controllers/StickerController";

const stickerRoutes = Router();
const upload = multer(uploadConfig);

stickerRoutes.get("/stickers",                       isAuth, requiresCompany, hasPermission("stickers:view"),   StickerController.index);
stickerRoutes.post("/stickers",                      isAuth, requiresCompany, hasPermission("stickers:create"), upload.single("file"), StickerController.store);
stickerRoutes.delete("/stickers/:stickerId",         isAuth, requiresCompany, hasPermission("stickers:delete"), StickerController.remove);

// Guardar uma figurinha que veio do cliente é adicionar ao catálogo, e por isso
// pede a mesma permissão de criar.
stickerRoutes.post("/stickers/from-message/:messageId", isAuth, requiresCompany, hasPermission("stickers:create"), StickerController.saveFromMessage);

// Enviar é permissão à parte de administrar a biblioteca: todo atendente manda
// figurinha na conversa, mas só quem cuida do catálogo adiciona ou remove.
stickerRoutes.post("/stickers/:stickerId/send/:ticketId", isAuth, requiresCompany, hasPermission("stickers:send"), StickerController.send);

export default stickerRoutes;
