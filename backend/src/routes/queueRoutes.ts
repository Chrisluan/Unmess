import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as QueueController from "../controllers/QueueController";

const queueRoutes = Router();

queueRoutes.get("/queue",             isAuth, requiresCompany, hasPermission("queues:view"),   QueueController.index);
queueRoutes.post("/queue",            isAuth, requiresCompany, hasPermission("queues:create"), QueueController.store);
queueRoutes.get("/queue/:queueId",    isAuth, requiresCompany, hasPermission("queues:view"),   QueueController.show);
queueRoutes.put("/queue/:queueId",    isAuth, requiresCompany, hasPermission("queues:edit"),   QueueController.update);
queueRoutes.delete("/queue/:queueId", isAuth, requiresCompany, hasPermission("queues:delete"), QueueController.remove);

export default queueRoutes;
