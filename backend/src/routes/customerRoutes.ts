import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as CustomerController from "../controllers/CustomerController";

const customerRoutes = express.Router();

customerRoutes.get("/customers",               isAuth, requiresCompany, hasPermission("clients:view"),   CustomerController.index);
// Rota mais específica primeiro, senão "/customers/by-contact" cairia em :customerId.
customerRoutes.get("/customers/by-contact/:contactId", isAuth, requiresCompany, hasPermission("tickets:view"), CustomerController.showByContact);
customerRoutes.get("/customers/:customerId",   isAuth, requiresCompany, hasPermission("clients:view"),   CustomerController.show);
customerRoutes.post("/customers",              isAuth, requiresCompany, hasPermission("clients:create"), CustomerController.store);
customerRoutes.put("/customers/:customerId",   isAuth, requiresCompany, hasPermission("clients:edit"),   CustomerController.update);
customerRoutes.delete("/customers/:customerId",isAuth, requiresCompany, hasPermission("clients:delete"), CustomerController.remove);

export default customerRoutes;
