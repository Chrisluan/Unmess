import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as BusinessHourController from "../controllers/BusinessHourController";

const businessHourRoutes = express.Router();

businessHourRoutes.get("/business-hours", isAuth, requiresCompany, hasPermission("settings:view"), BusinessHourController.index);
businessHourRoutes.put("/business-hours", isAuth, requiresCompany, hasPermission("settings:edit"), BusinessHourController.update);

// Feriados / exceções do calendário de atendimento.
businessHourRoutes.get("/holidays",             isAuth, requiresCompany, hasPermission("settings:view"), BusinessHourController.indexHolidays);
businessHourRoutes.post("/holidays",            isAuth, requiresCompany, hasPermission("settings:edit"), BusinessHourController.storeHoliday);
businessHourRoutes.delete("/holidays/:holidayId", isAuth, requiresCompany, hasPermission("settings:edit"), BusinessHourController.removeHoliday);

export default businessHourRoutes;
