import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as DealController from "../controllers/DealController";
import * as DealActivityController from "../controllers/DealActivityController";
import * as DealItemController from "../controllers/DealItemController";
import * as DealAttachmentController from "../controllers/DealAttachmentController";
import uploadConfig from "../config/upload";
import { TIPOS_DE_TAREFA } from "../helpers/TiposDeTarefa";
import { MOTIVOS_DE_PERDA } from "../helpers/MotivosDePerda";
import * as PipelineStageController from "../controllers/PipelineStageController";
import * as BoardController from "../controllers/BoardController";

const crmRoutes = express.Router();

// Mesma configuração dos demais anexos: pasta pública, nome aleatório, tipos
// permitidos e teto de 25 MB.
const upload = multer(uploadConfig);

// ── Quadros ─────────────────────────────────────────────────────────────────
// Reordenar quadros muda o caminho que todo card percorre, por isso a criação
// e a ordenação exigem permissão própria, separada da de colunas.
crmRoutes.get("/boards",             isAuth, requiresCompany, hasPermission("crm:view"),         BoardController.index);
crmRoutes.post("/boards",            isAuth, requiresCompany, hasPermission("crm:manageBoards"), BoardController.store);
// Rota fixa antes da paramétrica, senão "/reorder" cairia em :boardId.
crmRoutes.put("/boards/reorder",     isAuth, requiresCompany, hasPermission("crm:manageBoards"), BoardController.reorder);
crmRoutes.put("/boards/:boardId",    isAuth, requiresCompany, hasPermission("crm:manageBoards"), BoardController.update);
crmRoutes.delete("/boards/:boardId", isAuth, requiresCompany, hasPermission("crm:manageBoards"), BoardController.remove);

// ── Colunas dos quadros ─────────────────────────────────────────────────────
crmRoutes.get("/pipeline-stages",          isAuth, requiresCompany, hasPermission("crm:view"),         PipelineStageController.index);
crmRoutes.post("/pipeline-stages",         isAuth, requiresCompany, hasPermission("crm:manageStages"), PipelineStageController.store);
// Rota fixa antes da paramétrica, senão "/reorder" cairia em :stageId.
crmRoutes.put("/pipeline-stages/reorder",  isAuth, requiresCompany, hasPermission("crm:manageStages"), PipelineStageController.reorder);
crmRoutes.put("/pipeline-stages/:stageId", isAuth, requiresCompany, hasPermission("crm:manageStages"), PipelineStageController.update);
crmRoutes.delete("/pipeline-stages/:stageId", isAuth, requiresCompany, hasPermission("crm:manageStages"), PipelineStageController.remove);

// ── Negócios ────────────────────────────────────────────────────────────────
crmRoutes.get("/deals",                isAuth, requiresCompany, hasPermission("crm:view"),   DealController.index);
crmRoutes.get("/deals/buscar",     isAuth, requiresCompany, hasPermission("crm:view"), DealController.buscar);
crmRoutes.get("/deals/indicadores", isAuth, requiresCompany, hasPermission("crm:view"), DealController.indicadores);
crmRoutes.get("/deals/summary",        isAuth, requiresCompany, hasPermission("crm:view"),   DealController.summary);
crmRoutes.get("/deals/:dealId",        isAuth, requiresCompany, hasPermission("crm:view"),   DealController.show);
crmRoutes.post("/deals",               isAuth, requiresCompany, hasPermission("crm:create"), DealController.store);
crmRoutes.put("/deals/:dealId/move",   isAuth, requiresCompany, hasPermission("crm:move"),   DealController.move);
crmRoutes.put("/deals/:dealId/ticket", isAuth, requiresCompany, hasPermission("crm:edit"),   DealController.linkTicket);
crmRoutes.put("/deals/:dealId",        isAuth, requiresCompany, hasPermission("crm:edit"),   DealController.update);
crmRoutes.delete("/deals/:dealId",     isAuth, requiresCompany, hasPermission("crm:delete"), DealController.remove);

// ── Timeline do negócio ─────────────────────────────────────────────────────

// Itens do pedido e emissao da ordem de servico.

// Catalogo de tipos de tarefa: o seletor da tela le daqui, para nao divergir
// da validacao do backend.
crmRoutes.get("/motivos-de-perda", isAuth, requiresCompany, hasPermission("crm:view"), (_req, res) =>
  res.json({ motivos: MOTIVOS_DE_PERDA })
);

crmRoutes.get("/tipos-de-tarefa", isAuth, requiresCompany, hasPermission("crm:view"), (_req, res) =>
  res.json({ tipos: TIPOS_DE_TAREFA })
);
crmRoutes.get("/deals/:dealId/items",     isAuth, requiresCompany, hasPermission("crm:view"), DealItemController.index);
crmRoutes.put("/deals/:dealId/items",     isAuth, requiresCompany, hasPermission("crm:edit"), DealItemController.sync);
crmRoutes.get("/deals/:dealId/ordem-servico", isAuth, requiresCompany, hasPermission("crm:view"), DealItemController.ordemDeServico);

// ── Material do pedido ──────────────────────────────────────────────────────
// A arte, o arquivo de impressão, a referência que o cliente mandou. Ler exige
// só ver o CRM; anexar e apagar mexem no pedido, e pedem crm:edit.
crmRoutes.get("/deals/:dealId/attachments",                    isAuth, requiresCompany, hasPermission("crm:view"), DealAttachmentController.index);
crmRoutes.post("/deals/:dealId/attachments",                   isAuth, requiresCompany, hasPermission("crm:edit"), upload.array("files"), DealAttachmentController.store);
crmRoutes.get("/deals/:dealId/midias-da-conversa",             isAuth, requiresCompany, hasPermission("crm:view"), DealAttachmentController.midiasDaConversa);
crmRoutes.post("/deals/:dealId/attachments/da-conversa",       isAuth, requiresCompany, hasPermission("crm:edit"), DealAttachmentController.importar);
crmRoutes.put("/deals/:dealId/attachments/:attachmentId/capa", isAuth, requiresCompany, hasPermission("crm:edit"), DealAttachmentController.definirCapa);
crmRoutes.delete("/deals/:dealId/attachments/:attachmentId",   isAuth, requiresCompany, hasPermission("crm:edit"), DealAttachmentController.remove);

// Visao inversa: os negocios de uma conversa, usada pelo painel do chat.
crmRoutes.get("/tickets/:ticketId/deals", isAuth, requiresCompany, hasPermission("crm:view"), DealItemController.byTicket);

crmRoutes.post("/deals/:dealId/activities",       isAuth, requiresCompany, hasPermission("crm:edit"), DealActivityController.store);
crmRoutes.put("/deal-activities/:activityId",     isAuth, requiresCompany, hasPermission("crm:edit"), DealActivityController.update);
crmRoutes.delete("/deal-activities/:activityId",  isAuth, requiresCompany, hasPermission("crm:edit"), DealActivityController.remove);

export default crmRoutes;
