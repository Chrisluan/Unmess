import { Router } from "express";
import * as SessionController from "../controllers/SessionController";
import isAuth from "../middleware/isAuth";

const authRoutes = Router();

authRoutes.post("/login",          SessionController.store);
authRoutes.post("/refresh_token",  SessionController.update);
authRoutes.delete("/logout",       isAuth, SessionController.remove);

// Super-admin seleciona empresa — emite token com companyId
authRoutes.post("/select-company", isAuth, SessionController.selectCompany);

export default authRoutes;
