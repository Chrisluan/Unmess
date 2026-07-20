import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import * as BusinessHourController from "../controllers/BusinessHourController";

const businessHourRoutes = express.Router();

businessHourRoutes.get("/business-hours",  isAuth, requiresCompany, BusinessHourController.index);
businessHourRoutes.put("/business-hours",  isAuth, requiresCompany, BusinessHourController.update);

export default businessHourRoutes;
