import AppError from "../../errors/AppError";
import Customer from "../../models/Customer";

interface Request {
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
  companyId: number;
}

const CreateCustomerService = async (
  customerData: Request
): Promise<Customer> => {
  const { document, companyId } = customerData;

  if (document) {
    const documentExists = await Customer.findOne({
      where: { document, companyId }
    });

    if (documentExists) {
      throw new AppError("ERR_DUPLICATED_CUSTOMER");
    }
  }

  const customer = await Customer.create({ ...customerData });

  await customer.reload({
    include: ["contact", "responsibleUser"]
  });

  return customer;
};

export default CreateCustomerService;
