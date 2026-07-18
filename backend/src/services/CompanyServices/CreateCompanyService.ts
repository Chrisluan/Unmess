import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";
import sequelize from "../../database";

interface Request {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  plan?: string;
  status?: string;
  dueDate?: Date;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

interface Response {
  company: Company;
  adminUser: User;
}

const CreateCompanyService = async ({
  name,
  document,
  email,
  phone,
  plan = "basic",
  status = "active",
  dueDate,
  adminName,
  adminEmail,
  adminPassword
}: Request): Promise<Response> => {
  if (document) {
    const documentExists = await Company.findOne({ where: { document } });

    if (documentExists) {
      throw new AppError("ERR_DUPLICATED_COMPANY_DOCUMENT");
    }
  }

  const result = await sequelize.transaction(async t => {
    const company = await Company.create(
      {
        name,
        document,
        email,
        phone,
        plan,
        status,
        dueDate
      },
      { transaction: t }
    );

    const adminUser = await User.create(
      {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        profile: "admin",
        companyId: company.id
      },
      { transaction: t }
    );

    return { company, adminUser };
  });

  return result;
};

export default CreateCompanyService;
