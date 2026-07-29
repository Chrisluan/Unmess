import AppError from "../../errors/AppError";
import Customer from "../../models/Customer";

interface CustomerData {
  name?: string;
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

interface Request {
  customerData: CustomerData;
  customerId: string | number;
  companyId: number;
}

const UpdateCustomerService = async ({
  customerData,
  customerId,
  companyId
}: Request): Promise<Customer> => {
  const customer = await Customer.findOne({
    where: { id: customerId, companyId }
  });

  if (!customer) {
    throw new AppError("ERR_NO_CUSTOMER_FOUND", 404);
  }

  const { document } = customerData;

  if (document && document !== customer.document) {
    const documentExists = await Customer.findOne({
      where: { document, companyId }
    });

    if (documentExists && documentExists.id !== customer.id) {
      throw new AppError("ERR_DUPLICATED_CUSTOMER");
    }
  }

  await customer.update(customerData);

  await customer.reload({
    include: ["contact", "responsibleUser"]
  });

  return customer;
};

export default UpdateCustomerService;
