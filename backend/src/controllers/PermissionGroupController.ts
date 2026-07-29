import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListPermissionGroupsService from "../services/PermissionGroupServices/ListPermissionGroupsService";
import CreatePermissionGroupService from "../services/PermissionGroupServices/CreatePermissionGroupService";
import ShowPermissionGroupService from "../services/PermissionGroupServices/ShowPermissionGroupService";
import UpdatePermissionGroupService from "../services/PermissionGroupServices/UpdatePermissionGroupService";
import DeletePermissionGroupService from "../services/PermissionGroupServices/DeletePermissionGroupService";
import { AVAILABLE_PERMISSIONS, PERMISSION_MODULES } from "../helpers/permissions/AvailablePermissions";
import { resolveUserPermissions } from "../helpers/permissions/GetUserPermissions";
import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";

/** Lista flat de todas as permissões disponíveis */
export const available = async (
  req: Request,
  res: Response
): Promise<Response> => {
  return res.status(200).json(AVAILABLE_PERMISSIONS);
};

/** Catálogo estruturado por módulo — usado pela UI de gerenciamento */
export const modules = async (
  req: Request,
  res: Response
): Promise<Response> => {
  return res.status(200).json(PERMISSION_MODULES);
};

/** Resolve permissões efetivas de um usuário (grupo + overrides) */
export const userPermissions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;

  // Somente admin/super pode consultar permissões de outros usuários
  if (
    req.user.profile !== "admin" &&
    req.user.profile !== "super" &&
    String(req.user.id) !== userId
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const result = await resolveUserPermissions(Number(userId));
  return res.status(200).json(result);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const groups = await ListPermissionGroupsService(getCompanyId(req));
  return res.status(200).json(groups);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, permissions } = req.body;

  const group = await CreatePermissionGroupService({
    name,
    permissions,
    companyId: getCompanyId(req),
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("permissionGroup", {
    action: "create",
    permissionGroup: group,
  });

  return res.status(200).json(group);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { permissionGroupId } = req.params;
  const group = await ShowPermissionGroupService(permissionGroupId, getCompanyId(req));
  return res.status(200).json(group);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { permissionGroupId } = req.params;
  const { name, permissions } = req.body;

  const group = await UpdatePermissionGroupService({
    id: permissionGroupId,
    name,
    permissions,
    companyId: getCompanyId(req),
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("permissionGroup", {
    action: "update",
    permissionGroup: group,
  });

  return res.status(200).json(group);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { permissionGroupId } = req.params;

  await DeletePermissionGroupService(permissionGroupId, getCompanyId(req));

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("permissionGroup", {
    action: "delete",
    permissionGroupId,
  });

  return res.status(200).json({ message: "Permission group deleted" });
};
