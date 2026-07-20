import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import * as SettingController from "../controllers/SettingController";

const settingRoutes = Router();

settingRoutes.get("/settings",               isAuth, requiresCompany, SettingController.index);
settingRoutes.put("/settings/:settingKey",   isAuth, requiresCompany, SettingController.update);

export default settingRoutes;
