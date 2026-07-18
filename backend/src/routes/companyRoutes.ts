import express from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";

import * as CompanyController from "../controllers/CompanyController";

const companyRoutes = express.Router();

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
