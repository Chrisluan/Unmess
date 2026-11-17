import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import uploadConfig from "../config/upload";

import * as CompanyController from "../controllers/CompanyController";
import * as BillingController from "../controllers/CompanyBillingController";
import { semPermissao } from "../helpers/permissions/routeGuard";

const companyRoutes = express.Router();

const upload = multer(uploadConfig);

// Identidade visual da empresa logada. Fica antes de "/companies/:companyId"
// para o parâmetro não capturar a palavra "branding".
companyRoutes.get(
  "/company/branding",
  isAuth,
  requiresCompany,
  semPermissao("logo e cores da empresa; toda tela logada precisa desenhá-las"),
  CompanyController.branding
);

companyRoutes.put(
  "/company/branding",
  isAuth,
  requiresCompany,
  hasPermission("settings:edit"),
  upload.single("logo"),
  CompanyController.updateBranding
);

companyRoutes.get("/companies", isAuth, isSuper, CompanyController.index);

companyRoutes.get(
  "/companies/:companyId",
  isAuth,
  isSuper,
  CompanyController.show
);

companyRoutes.post("/companies", isAuth, isSuper, CompanyController.store);

companyRoutes.put(
  "/companies/:companyId",
  isAuth,
  isSuper,
  CompanyController.update
);

companyRoutes.delete(
  "/companies/:companyId",
  isAuth,
  isSuper,
  CompanyController.remove
);

/**
 * Aviso de pagamento do gateway.
 *
 * Sem isAuth de propósito: quem chama é o Asaas, que não tem usuário nem
 * token JWT. A autenticação é o segredo no cabeçalho, conferido no
 * controller. Fica antes das rotas com `:companyId` para o parâmetro não
 * engolir o caminho.
 */
companyRoutes.post(
  "/billing/webhook/asaas",
  semPermissao("chamada de máquina do gateway, autenticada pelo segredo no cabeçalho dentro do controller"),
  BillingController.webhookAsaas
);

// ── Painel do super: usuários, acesso e cobrança de cada empresa ────────────
companyRoutes.get(
  "/companies/:companyId/users",
  isAuth,
  isSuper,
  BillingController.usuarios
);

companyRoutes.get(
  "/companies/:companyId/roles",
  isAuth,
  isSuper,
  BillingController.cargos
);

companyRoutes.put(
  "/companies/:companyId/users/:userId",
  isAuth,
  isSuper,
  BillingController.alterarUsuario
);

companyRoutes.put(
  "/companies/:companyId/access",
  isAuth,
  isSuper,
  BillingController.alterarAcesso
);

companyRoutes.get(
  "/companies/:companyId/invoices",
  isAuth,
  isSuper,
  BillingController.listarFaturas
);

companyRoutes.post(
  "/companies/:companyId/invoices",
  isAuth,
  isSuper,
  BillingController.emitirFatura
);

companyRoutes.put(
  "/invoices/:invoiceId/pay",
  isAuth,
  isSuper,
  BillingController.baixar
);

companyRoutes.put(
  "/invoices/:invoiceId/unpay",
  isAuth,
  isSuper,
  BillingController.estornar
);

companyRoutes.put(
  "/invoices/:invoiceId/cancel",
  isAuth,
  isSuper,
  BillingController.cancelar
);

companyRoutes.put(
  "/invoices/:invoiceId/sync",
  isAuth,
  isSuper,
  BillingController.sincronizar
);

export default companyRoutes;
