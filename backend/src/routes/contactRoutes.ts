import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";

const contactRoutes = express.Router();

contactRoutes.post("/contacts/import",        isAuth, requiresCompany, hasPermission("contacts:import"), ImportPhoneContactsController.store);
contactRoutes.get("/contacts",                isAuth, requiresCompany, hasPermission("contacts:view"),   ContactController.index);
contactRoutes.get("/contacts/:contactId",     isAuth, requiresCompany, hasPermission("contacts:view"),   ContactController.show);
contactRoutes.post("/contacts",               isAuth, requiresCompany, hasPermission("contacts:create"), ContactController.store);
contactRoutes.post("/contact",                isAuth, requiresCompany, hasPermission("contacts:view"),   ContactController.getContact);
contactRoutes.put("/contacts/:contactId",     isAuth, requiresCompany, hasPermission("contacts:edit"),   ContactController.update);
contactRoutes.delete("/contacts/:contactId",  isAuth, requiresCompany, hasPermission("contacts:delete"), ContactController.remove);

export default contactRoutes;
