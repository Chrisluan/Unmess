import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListCustomersService from "../services/CustomerServices/ListCustomersService";
import CreateCustomerService from "../services/CustomerServices/CreateCustomerService";
import ShowCustomerService from "../services/CustomerServices/ShowCustomerService";
import UpdateCustomerService from "../services/CustomerServices/UpdateCustomerService";
import DeleteCustomerService from "../services/CustomerServices/DeleteCustomerService";
import ShowCustomerByContactService from "../services/CustomerServices/ShowCustomerByContactService";
import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
};

interface CustomerData {
  name: string;
  tradeName?: string;
  personType?: string;
  document?: string;
  stateRegistration?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  zipCode?: string;
  street?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  segment?: string;
  origin?: string;
  status?: string;
  notes?: string;
  contactId?: number;
  responsibleUserId?: number;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, status } = req.query as IndexQuery;
  const companyId = getCompanyId(req);

  const { customers, count, hasMore } = await ListCustomersService({
    searchParam,
    pageNumber,
    status,
    companyId
  });

  return res.json({ customers, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newCustomer: CustomerData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    personType: Yup.string().oneOf(["PF", "PJ"]),
    email: Yup.string().email(),
    status: Yup.string().oneOf(["lead", "active", "inactive"])
  });

  try {
    await schema.validate(newCustomer);
  } catch (err) {
    throw new AppError(err.message);
  }

  const customer = await CreateCustomerService({
    ...newCustomer,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("customer", {
    action: "create",
    customer
  });

  return res.status(200).json(customer);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { customerId } = req.params;

  const customer = await ShowCustomerService(customerId, getCompanyId(req));

  return res.status(200).json(customer);
};

/**
 * Cliente vinculado a um contato — usado pelo painel lateral do chat.
 * Devolve null quando ainda não há cadastro, sem tratar isso como erro.
 */
export const showByContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;

  const customer = await ShowCustomerByContactService(
    Number(contactId),
    getCompanyId(req)
  );

  return res.status(200).json(customer);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const customerData: CustomerData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string(),
    personType: Yup.string().oneOf(["PF", "PJ"]),
    email: Yup.string().email(),
    status: Yup.string().oneOf(["lead", "active", "inactive"])
  });

  try {
    await schema.validate(customerData);
  } catch (err) {
    throw new AppError(err.message);
  }

  const { customerId } = req.params;

  const customer = await UpdateCustomerService({
    customerData,
    customerId,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("customer", {
    action: "update",
    customer
  });

  return res.status(200).json(customer);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { customerId } = req.params;

  await DeleteCustomerService(customerId, getCompanyId(req));

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("customer", {
    action: "delete",
    customerId
  });

  return res.status(200).json({ message: "Customer deleted" });
};
