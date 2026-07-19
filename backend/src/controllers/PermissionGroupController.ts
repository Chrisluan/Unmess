import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListPermissionGroupsService from "../services/PermissionGroupServices/ListPermissionGroupsService";
import CreatePermissionGroupService from "../services/PermissionGroupServices/CreatePermissionGroupService";
import ShowPermissionGroupService from "../services/PermissionGroupServices/ShowPermissionGroupService";
import UpdatePermissionGroupService from "../services/PermissionGroupServices/UpdatePermissionGroupService";
import DeletePermissionGroupService from "../services/PermissionGroupServices/DeletePermissionGroupService";
import { AVAILABLE_PERMISSIONS } from "../helpers/permissions/AvailablePermissions";

export const available = async (
  req: Request,
  res: Response
): Promise<Response> => {
  return res.status(200).json(AVAILABLE_PERMISSIONS);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const groups = await ListPermissionGroupsService(req.user.companyId);

  return res.status(200).json(groups);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, permissions } = req.body;

  const group = await CreatePermissionGroupService({
    name,
    permissions,
    companyId: req.user.companyId
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("permissionGroup", {
    action: "create",
    permissionGroup: group
  });

  return res.status(200).json(group);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { permissionGroupId } = req.params;

  const group = await ShowPermissionGroupService(
    permissionGroupId,
    req.user.companyId
  );

  return res.status(200).json(group);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { permissionGroupId } = req.params;
  const { name, permissions } = req.body;

  const group = await UpdatePermissionGroupService({
    id: permissionGroupId,
    name,
    permissions,
    companyId: req.user.companyId
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("permissionGroup", {
    action: "update",
    permissionGroup: group
  });

  return res.status(200).json(group);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { permissionGroupId } = req.params;

  await DeletePermissionGroupService(permissionGroupId, req.user.companyId);

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("permissionGroup", {
    action: "delete",
    permissionGroupId
  });

  return res.status(200).json({ message: "Permission group deleted" });
};
