import express from "express";
import isAuth from "../middleware/isAuth";

import * as BusinessHourController from "../controllers/BusinessHourController";

const businessHourRoutes = express.Router();

businessHourRoutes.get("/business-hours", isAuth, BusinessHourController.index);
businessHourRoutes.put("/business-hours", isAuth, BusinessHourController.update);

export default businessHourRoutes;
