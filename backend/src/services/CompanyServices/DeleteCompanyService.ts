import Company from "../../models/Company";
import User from "../../models/User";
import AppError from "../../errors/AppError";

const DeleteCompanyService = async (id: string): Promise<void> => {
  const company = await Company.findByPk(id);

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const usersCount = await User.count({ where: { companyId: id } });

  if (usersCount > 0) {
    throw new AppError("ERR_COMPANY_HAS_USERS");
  }

  await company.destroy();
};

export default DeleteCompanyService;
