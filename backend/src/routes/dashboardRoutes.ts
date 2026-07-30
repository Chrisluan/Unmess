import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as DashboardController from "../controllers/DashboardController";

const dashboardRoutes = express.Router();

dashboardRoutes.get("/dashboard/metrics", isAuth, requiresCompany, hasPermission("dashboard:view"), DashboardController.index);

export default dashboardRoutes;
