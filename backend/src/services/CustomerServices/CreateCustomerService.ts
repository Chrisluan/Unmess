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

  // Um cliente por contato: o contato do WhatsApp é como a conversa chega
  // ao cadastro, e dois clientes no mesmo contato deixavam o pedido sem saber
  // de qual era. O banco também garante (índice único).
  const contatoId = (customerData as { contactId?: number | null }).contactId;
  if (contatoId) {
    const doContato = await Customer.findOne({
      where: { contactId: contatoId, companyId },
      attributes: ["id"]
    });
    if (doContato) {
      throw new AppError("ERR_CONTATO_JA_TEM_CLIENTE", 409, { customerId: doContato.id });
    }
  }

  if (document) {
    const documentExists = await Customer.findOne({
      where: { document, companyId }
    });

    if (documentExists) {
      throw new AppError("ERR_DUPLICATED_CUSTOMER");
    }
  }

  // Os ids no gateway são preenchidos pela emissão, nunca por quem cadastra.
  const { gatewayIds: _doSistema, ...dados } = customerData as Request & { gatewayIds?: unknown };
  const customer = await Customer.create({ ...dados });

  await customer.reload({
    include: ["contact", "responsibleUser"]
  });

  return customer;
};

export default CreateCustomerService;
