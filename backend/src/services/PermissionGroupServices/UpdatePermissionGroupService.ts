import PermissionGroup from "../../models/PermissionGroup";
import AppError from "../../errors/AppError";
import { AVAILABLE_PERMISSIONS } from "../../helpers/permissions/AvailablePermissions";

interface Request {
  id: string | number;
  name?: string;
  permissions?: string[];
  companyId: number;
}

const UpdatePermissionGroupService = async ({
  id,
  name,
  permissions,
  companyId
}: Request): Promise<PermissionGroup> => {
  const group = await PermissionGroup.findOne({ where: { id, companyId } });

  if (!group) {
    throw new AppError("ERR_NO_PERMISSION_GROUP_FOUND", 404);
  }

  const validPermissions = permissions
    ? permissions.filter(p =>
        (AVAILABLE_PERMISSIONS as readonly string[]).includes(p)
      )
    : undefined;

  await group.update({
    name,
    permissions: validPermissions
      ? JSON.stringify(validPermissions)
      : undefined
  });

  return group;
};

export default UpdatePermissionGroupService;
