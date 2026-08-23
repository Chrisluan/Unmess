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
  monthlyFee?: number;
  billingDay?: number;
  blockWhenOverdue?: boolean;
  overdueGraceDays?: number;
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

  const {
    name,
    document,
    email,
    phone,
    plan,
    dueDate,
    monthlyFee,
    billingDay,
    blockWhenOverdue,
    overdueGraceDays
  } = companyData;

  /**
   * O status não entra por aqui de propósito.
   *
   * Bloquear e liberar uma empresa tem consequências que um update de cadastro
   * não tem — encerra as sessões abertas, grava o motivo e a data — e passa
   * por AlterarAcessoService. Aceitar o campo nos dois lugares deixaria dois
   * caminhos para a mesma decisão, e só um deles faria a coisa completa.
   */
  await company.update({
    name,
    document,
    email,
    phone,
    plan,
    dueDate,
    monthlyFee,
    billingDay,
    blockWhenOverdue,
    overdueGraceDays
  });

  await company.reload();

  return company;
};

export default UpdateCompanyService;
