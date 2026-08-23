import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";
import Role from "../../models/Role";
import SeedDefaultBoardsService from "../BoardServices/SeedDefaultBoardsService";
import sequelize from "../../database";
import { ALL_PERMISSIONS } from "../../helpers/permissions/catalog";
import { SLUG_ADMINISTRADOR } from "../../helpers/permissions/roleTemplates";

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

    /**
     * A empresa nasce com o cargo de Administrador, e a primeira pessoa nele.
     *
     * O cargo é criado aqui, dentro da mesma transação da empresa: uma empresa
     * que exista sem Administrador é uma empresa onde ninguém consegue liberar
     * nada para ninguém — inclusive para si mesmo.
     */
    const adminRole = await Role.create(
      {
        name: "Administrador",
        slug: SLUG_ADMINISTRADOR,
        description:
          "Acesso total ao sistema. Mantido pelo sistema: não pode ser editado nem excluído, e toda permissão criada daqui para a frente já nasce incluída.",
        permissions: JSON.stringify([...ALL_PERMISSIONS]),
        isSystem: true,
        companyId: company.id
      } as any,
      { transaction: t }
    );

    const adminUser = await User.create(
      {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        profile: "member",
        roleId: adminRole.id,
        companyId: company.id
      },
      { transaction: t }
    );

    // A empresa já nasce com o fluxo montado (Vendas → Produção → Expedição →
    // Financeiro): um CRM sem quadro não deixa nem criar o primeiro card.
    await SeedDefaultBoardsService(company.id, t);

    return { company, adminUser };
  });

  return result;
};

export default CreateCompanyService;
