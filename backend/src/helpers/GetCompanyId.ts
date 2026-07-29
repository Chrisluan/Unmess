import { Request } from "express";
import AppError from "../errors/AppError";

/**
 * Acessor type-safe para req.user.companyId.
 * Rotas que chamam isso já passaram pelo middleware requiresCompany,
 * que garante companyId truthy em runtime — este helper só formaliza
 * essa garantia para o TypeScript (e serve como segunda camada de defesa).
 */
const getCompanyId = (req: Request): number => {
  if (!req.user.companyId) {
    throw new AppError(
      "Esta ação requer contexto de empresa. O super-admin deve acessar via painel de empresas.",
      403
    );
  }
  return req.user.companyId;
};

export default getCompanyId;
