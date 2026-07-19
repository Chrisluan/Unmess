import PermissionGroup from "../../models/PermissionGroup";
import User from "../../models/User";
import AppError from "../../errors/AppError";

const DeletePermissionGroupService = async (
  id: string,
  companyId: number
): Promise<void> => {
  const group = await PermissionGroup.findOne({ where: { id, companyId } });

  if (!group) {
    throw new AppError("ERR_NO_PERMISSION_GROUP_FOUND", 404);
  }

  const usersCount = await User.count({ where: { permissionGroupId: id } });

  if (usersCount > 0) {
    throw new AppError("ERR_PERMISSION_GROUP_HAS_USERS");
  }

  await group.destroy();
};

export default DeletePermissionGroupService;
