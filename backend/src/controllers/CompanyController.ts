import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListCompaniesService from "../services/CompanyServices/ListCompaniesService";
import CreateCompanyService from "../services/CompanyServices/CreateCompanyService";
import ShowCompanyService from "../services/CompanyServices/ShowCompanyService";
import UpdateCompanyService from "../services/CompanyServices/UpdateCompanyService";
import DeleteCompanyService from "../services/CompanyServices/DeleteCompanyService";
import ShowBrandingService from "../services/CompanyServices/ShowBrandingService";
import UpdateBrandingService from "../services/CompanyServices/UpdateBrandingService";
import getCompanyId from "../helpers/GetCompanyId";
import AppError from "../errors/AppError";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
};

interface CompanyData {
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

/**
 * Nome e logo da empresa logada. Liberado a qualquer usuário autenticado
 * porque a barra lateral precisa desses dados para todo mundo — diferente das
 * demais rotas de empresa, restritas ao super-admin.
 */
export const branding = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const dados = await ShowBrandingService(getCompanyId(req));
  return res.status(200).json(dados);
};

export const updateBranding = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, removeLogo } = req.body as {
    name?: string;
    removeLogo?: string;
  };

  const dados = await UpdateBrandingService({
    companyId: getCompanyId(req),
    name,
    logoFile: req.file,
    removeLogo: removeLogo === "true"
  });

  getIO()
    .to(`company-${req.user.companyId}`)
    .emit("branding", { action: "update", branding: dados });

  return res.status(200).json(dados);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, status } = req.query as IndexQuery;

  const { companies, count, hasMore } = await ListCompaniesService({
    searchParam,
    pageNumber,
    status
  });

  return res.json({ companies, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newCompany: CompanyData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    adminName: Yup.string().required().min(2),
    adminEmail: Yup.string().email().required(),
    adminPassword: Yup.string().required().min(5)
  });

  try {
    await schema.validate(newCompany);
  } catch (err) {
    throw new AppError(err.message);
  }

  const { company, adminUser } = await CreateCompanyService(newCompany);

  const io = getIO();
  io.emit("company", {
    action: "create",
    company
  });

  return res.status(200).json({ company, adminUser });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.params;

  const company = await ShowCompanyService(companyId);

  return res.status(200).json(company);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyData: CompanyData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string()
  });

  try {
    await schema.validate(companyData);
  } catch (err) {
    throw new AppError(err.message);
  }

  const { companyId } = req.params;

  const company = await UpdateCompanyService({ companyData, companyId });

  const io = getIO();
  io.emit("company", {
    action: "update",
    company
  });

  return res.status(200).json(company);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.params;

  await DeleteCompanyService(companyId);

  const io = getIO();
  io.emit("company", {
    action: "delete",
    companyId
  });

  return res.status(200).json({ message: "Company deleted" });
};
