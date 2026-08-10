import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import uploadConfig from "../config/upload";

import * as CompanyController from "../controllers/CompanyController";

const companyRoutes = express.Router();

const upload = multer(uploadConfig);

// Identidade visual da empresa logada. Fica antes de "/companies/:companyId"
// para o parâmetro não capturar a palavra "branding".
companyRoutes.get(
  "/company/branding",
  isAuth,
  requiresCompany,
  CompanyController.branding
);

companyRoutes.put(
  "/company/branding",
  isAuth,
  requiresCompany,
  hasPermission("settings:edit"),
  upload.single("logo"),
  CompanyController.updateBranding
);

companyRoutes.get("/companies", isAuth, isSuper, CompanyController.index);

companyRoutes.get(
  "/companies/:companyId",
  isAuth,
  isSuper,
  CompanyController.show
);

companyRoutes.post("/companies", isAuth, isSuper, CompanyController.store);

companyRoutes.put(
  "/companies/:companyId",
  isAuth,
  isSuper,
  CompanyController.update
);

companyRoutes.delete(
  "/companies/:companyId",
  isAuth,
  isSuper,
  CompanyController.remove
);

export default companyRoutes;
