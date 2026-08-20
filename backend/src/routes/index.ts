import { Router } from "express";

import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import settingRoutes from "./settingRoutes";
import contactRoutes from "./contactRoutes";
import ticketRoutes from "./ticketRoutes";
import whatsappRoutes from "./whatsappRoutes";
import messageRoutes from "./messageRoutes";
import whatsappSessionRoutes from "./whatsappSessionRoutes";
import queueRoutes from "./queueRoutes";
import quickAnswerRoutes from "./quickAnswerRoutes";
import apiRoutes from "./apiRoutes";
import companyRoutes from "./companyRoutes";
import permissionGroupRoutes from "./permissionGroupRoutes";
import ticketStatusRoutes from "./ticketStatusRoutes";
import businessHourRoutes from "./businessHourRoutes";
import dashboardRoutes from "./dashboardRoutes";
import customerRoutes from "./customerRoutes";
import tagRoutes from "./tagRoutes";
import crmRoutes from "./crmRoutes";
import stickerRoutes from "./stickerRoutes";
import productRoutes from "./productRoutes";

const routes = Router();

routes.use(userRoutes);
routes.use("/auth", authRoutes);
routes.use(settingRoutes);
routes.use(contactRoutes);
routes.use(ticketRoutes);
routes.use(whatsappRoutes);
routes.use(messageRoutes);
routes.use(whatsappSessionRoutes);
routes.use(queueRoutes);
routes.use(quickAnswerRoutes);
routes.use("/api/messages", apiRoutes);
routes.use(companyRoutes);
routes.use(permissionGroupRoutes);
routes.use(ticketStatusRoutes);
routes.use(businessHourRoutes);
routes.use(dashboardRoutes);
routes.use(customerRoutes);
routes.use(tagRoutes);
routes.use(crmRoutes);
routes.use(stickerRoutes);
routes.use(productRoutes);

export default routes;
