import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as SettingController from "../controllers/SettingController";

const settingRoutes = Router();

// Precisa vir antes de "/settings" com params para não colidir na ordem.
settingRoutes.get("/settings/attendance",  isAuth, requiresCompany, hasPermission("tickets:view"),  SettingController.attendance);
settingRoutes.get("/settings",             isAuth, requiresCompany, hasPermission("settings:view"), SettingController.index);
settingRoutes.put("/settings/:settingKey", isAuth, requiresCompany, hasPermission("settings:edit"), SettingController.update);

export default settingRoutes;
