import PermissionGroup from "../../models/PermissionGroup";
import AppError from "../../errors/AppError";

const ShowPermissionGroupService = async (
  id: string | number,
  companyId: number
): Promise<PermissionGroup> => {
  const group = await PermissionGroup.findOne({ where: { id, companyId } });

  if (!group) {
    throw new AppError("ERR_NO_PERMISSION_GROUP_FOUND", 404);
  }

  return group;
};

export default ShowPermissionGroupService;
