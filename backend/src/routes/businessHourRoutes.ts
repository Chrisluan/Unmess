import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as BusinessHourController from "../controllers/BusinessHourController";

const businessHourRoutes = express.Router();

businessHourRoutes.get("/business-hours", isAuth, requiresCompany, hasPermission("settings:view"), BusinessHourController.index);
businessHourRoutes.put("/business-hours", isAuth, requiresCompany, hasPermission("settings:edit"), BusinessHourController.update);

export default businessHourRoutes;
