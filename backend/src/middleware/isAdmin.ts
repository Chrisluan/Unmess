import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";

/** Garante que apenas admin ou super podem prosseguir. */
const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user.profile !== "admin" && req.user.profile !== "super") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  next();
};

export default isAdmin;
