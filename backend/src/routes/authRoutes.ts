import { Router } from "express";
import * as SessionController from "../controllers/SessionController";
import isAuth from "../middleware/isAuth";

const authRoutes = Router();

// Signup público foi desativado: no modelo multi-tenant, empresas (tenants)
// são criadas exclusivamente pelo super-admin via POST /companies, que já
// cria automaticamente o primeiro usuário admin da empresa nesse mesmo passo.
// authRoutes.post("/signup", UserController.store);

authRoutes.post("/login", SessionController.store);

authRoutes.post("/refresh_token", SessionController.update);

authRoutes.delete("/logout", isAuth, SessionController.remove);

export default authRoutes;
