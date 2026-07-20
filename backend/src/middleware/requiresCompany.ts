import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";

/**
 * Garante que a requisição tem um companyId válido em req.user.
 * O super-admin (profile "super") não pertence a nenhuma empresa —
 * ele não deve acessar endpoints de dados de empresa diretamente.
 *
 * Deve ser usado após isAuth em qualquer rota que grava/lê dados de empresa.
 */
const requiresCompany = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user.companyId) {
    throw new AppError(
      "Esta ação requer contexto de empresa. O super-admin deve acessar via painel de empresas.",
      403
    );
  }
  next();
};

export default requiresCompany;
