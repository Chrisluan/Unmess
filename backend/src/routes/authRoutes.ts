import { Router } from "express";
import * as SessionController from "../controllers/SessionController";
import isAuth from "../middleware/isAuth";
import { limitadorLogin } from "../middleware/limitarRequisicoes";

const authRoutes = Router();

// O limite fica só no login: é a única rota onde adivinhar em série leva a
// algum lugar. As demais já exigem um token válido para responder qualquer
// coisa.
authRoutes.post("/login",          limitadorLogin, SessionController.store);
authRoutes.post("/refresh_token",  SessionController.update);
authRoutes.delete("/logout",       isAuth, SessionController.remove);

// Super-admin seleciona empresa — emite token com companyId
authRoutes.post("/select-company", isAuth, SessionController.selectCompany);

export default authRoutes;
