import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { userHasPermission } from "../helpers/permissions/GetUserPermissions";
import { Permission } from "../helpers/permissions/AvailablePermissions";

// Deve ser usado sempre depois do isAuth na cadeia de middlewares da rota.
// Uso: router.delete("/chats/:id", isAuth, hasPermission("chats:delete"), ...)
const hasPermission = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const allowed = await userHasPermission(Number(req.user.id), permission);

    if (!allowed) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    return next();
  };
};

export default hasPermission;
