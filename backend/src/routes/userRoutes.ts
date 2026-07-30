import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as UserController from "../controllers/UserController";

const userRoutes = Router();

// /users sem companyId é legítimo apenas para o super listar todos —
// mas a listagem do super vem por companyRoutes. Aqui sempre requer empresa.
userRoutes.get("/users",            isAuth, requiresCompany, hasPermission("users:view"),   UserController.index);
userRoutes.post("/users",           isAuth, requiresCompany, hasPermission("users:create"), UserController.store);
userRoutes.put("/users/:userId",    isAuth, requiresCompany, hasPermission("users:edit"),   UserController.update);
userRoutes.get("/users/:userId",    isAuth, requiresCompany, hasPermission("users:view"),   UserController.show);
userRoutes.delete("/users/:userId", isAuth, requiresCompany, hasPermission("users:delete"), UserController.remove);

export default userRoutes;
