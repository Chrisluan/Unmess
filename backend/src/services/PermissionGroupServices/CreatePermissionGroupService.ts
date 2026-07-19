import * as Yup from "yup";
import AppError from "../../errors/AppError";
import PermissionGroup from "../../models/PermissionGroup";
import { AVAILABLE_PERMISSIONS } from "../../helpers/permissions/AvailablePermissions";

interface Request {
  name: string;
  permissions: string[];
  companyId: number;
}

const CreatePermissionGroupService = async ({
  name,
  permissions = [],
  companyId
}: Request): Promise<PermissionGroup> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2)
  });

  try {
    await schema.validate({ name });
  } catch (err) {
    throw new AppError(err.message);
  }

  const validPermissions = permissions.filter(p =>
    (AVAILABLE_PERMISSIONS as readonly string[]).includes(p)
  );

  const group = await PermissionGroup.create({
    name,
    permissions: JSON.stringify(validPermissions),
    companyId
  });

  return group;
};

export default CreatePermissionGroupService;
