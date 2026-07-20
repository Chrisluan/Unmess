import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { userHasPermission } from "../helpers/permissions/GetUserPermissions";
import { Permission } from "../helpers/permissions/AvailablePermissions";

/**
 * Middleware de autorização granular.
 * Deve ser usado após isAuth na cadeia de middlewares.
 *
 * Uso: router.delete("/tickets/:id", isAuth, hasPermission("tickets:delete"), handler)
 *
 * Admin e super passam automaticamente (ver GetUserPermissions).
 */
const hasPermission = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const allowed = await userHasPermission(Number(req.user.id), permission);

    if (!allowed) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    next();
  };
};

export default hasPermission;
