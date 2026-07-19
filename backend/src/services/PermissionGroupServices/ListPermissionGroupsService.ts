import PermissionGroup from "../../models/PermissionGroup";

const ListPermissionGroupsService = async (
  companyId: number
): Promise<PermissionGroup[]> => {
  const groups = await PermissionGroup.findAll({
    where: { companyId },
    order: [["name", "ASC"]]
  });

  return groups;
};

export default ListPermissionGroupsService;
