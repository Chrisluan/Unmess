import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as QuickAnswerController from "../controllers/QuickAnswerController";

const quickAnswerRoutes = Router();

quickAnswerRoutes.get("/quick-answers",                    isAuth, requiresCompany, hasPermission("quickAnswers:view"),   QuickAnswerController.index);
quickAnswerRoutes.post("/quick-answers",                   isAuth, requiresCompany, hasPermission("quickAnswers:create"), QuickAnswerController.store);
quickAnswerRoutes.put("/quick-answers/:quickAnswerId",     isAuth, requiresCompany, hasPermission("quickAnswers:edit"),   QuickAnswerController.update);
quickAnswerRoutes.delete("/quick-answers/:quickAnswerId",  isAuth, requiresCompany, hasPermission("quickAnswers:delete"), QuickAnswerController.remove);

export default quickAnswerRoutes;
