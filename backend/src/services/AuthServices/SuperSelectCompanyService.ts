import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";
import { createAccessToken } from "../../helpers/CreateTokens";

interface Request {
  superUserId: number;
  companyId: number;
}

export const SuperSelectCompanyService = async ({
  superUserId,
  companyId,
}: Request): Promise<string> => {
  const company = await Company.findByPk(companyId);

  if (!company) {
    throw new AppError("Empresa não encontrada", 404);
  }

  const superUser = await User.findByPk(superUserId);
  if (!superUser) {
    throw new AppError("ERR_USER_NOT_FOUND", 404);
  }

  // Emite access token com companyId + companyName injetados
  const token = createAccessToken({
    ...superUser.get(),
    companyId: company.id,
    companyName: company.name,
  } as any);

  return token;
};
