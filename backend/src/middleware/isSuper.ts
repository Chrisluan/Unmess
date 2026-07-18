import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";

// Deve ser usado sempre depois do isAuth na cadeia de middlewares da rota.
// Garante que só o super-admin (profile "super", sem empresa vinculada)
// acesse rotas de administração global do SaaS (ex: cadastro de empresas).
const isSuper = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user.profile !== "super") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return next();
};

export default isSuper;
