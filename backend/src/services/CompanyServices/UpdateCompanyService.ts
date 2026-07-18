import AppError from "../../errors/AppError";
import Company from "../../models/Company";

interface CompanyData {
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  plan?: string;
  status?: string;
  dueDate?: Date;
}

interface Request {
  companyData: CompanyData;
  companyId: string;
}

const UpdateCompanyService = async ({
  companyData,
  companyId
}: Request): Promise<Company> => {
  const company = await Company.findByPk(companyId);

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const { name, document, email, phone, plan, status, dueDate } = companyData;

  await company.update({
    name,
    document,
    email,
    phone,
    plan,
    status,
    dueDate
  });

  await company.reload();

  return company;
};

export default UpdateCompanyService;
