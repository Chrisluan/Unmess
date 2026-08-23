import { Router } from "express";
import * as SessionController from "../controllers/SessionController";
import isAuth from "../middleware/isAuth";
import { limitadorLogin } from "../middleware/limitarRequisicoes";
import { semPermissao } from "../helpers/permissions/routeGuard";

const authRoutes = Router();

// O limite fica só no login: é a única rota onde adivinhar em série leva a
// algum lugar. As demais já exigem um token válido para responder qualquer
// coisa.
authRoutes.post(
  "/login",
  limitadorLogin,
  semPermissao("é a rota que cria a sessão; não há usuário ainda"),
  SessionController.store
);
authRoutes.post(
  "/refresh_token",
  semPermissao("renova a sessão a partir do cookie; valida o refresh token por conta própria"),
  SessionController.update
);
authRoutes.delete(
  "/logout",
  isAuth,
  semPermissao("sair do sistema é direito de qualquer pessoa logada"),
  SessionController.remove
);

// Super-admin seleciona empresa — emite token com companyId
authRoutes.post(
  "/select-company",
  isAuth,
  semPermissao("o controller aceita apenas o super-admin da plataforma"),
  SessionController.selectCompany
);

export default authRoutes;
