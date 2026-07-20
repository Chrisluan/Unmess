import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import * as DashboardController from "../controllers/DashboardController";

const dashboardRoutes = express.Router();

dashboardRoutes.get("/dashboard/metrics", isAuth, requiresCompany, DashboardController.index);

export default dashboardRoutes;
