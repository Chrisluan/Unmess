import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import ShowUserService from "./ShowUserService";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  queueIds?: number[];
  whatsappId?: number;
  permissionGroupId?: number;
  maxSimultaneousTickets?: number;
  customPermissions?: { add?: string[]; remove?: string[] };
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({
  userData,
  userId,
  companyId
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(userId);

  if (user.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string()
  });

  const {
    email,
    password,
    profile,
    name,
    queueIds = [],
    whatsappId,
    permissionGroupId,
    maxSimultaneousTickets,
    customPermissions
  } = userData;

  try {
    await schema.validate({ email, password, profile, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  await user.update({
    email,
    password,
    profile,
    name,
    whatsappId: whatsappId ? whatsappId : null,
    permissionGroupId:
      permissionGroupId !== undefined ? permissionGroupId : user.permissionGroupId,
    maxSimultaneousTickets:
      maxSimultaneousTickets !== undefined
        ? Number(maxSimultaneousTickets) || 0
        : user.maxSimultaneousTickets,
    customPermissions: customPermissions
      ? JSON.stringify(customPermissions)
      : user.customPermissions
  });

  await user.$set("queues", queueIds);

  await user.reload();

  return SerializeUser(user);
};

export default UpdateUserService;
