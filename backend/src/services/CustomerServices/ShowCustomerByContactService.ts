import Customer from "../../models/Customer";
import User from "../../models/User";

/**
 * Cliente vinculado a um contato. Retorna null (não erro) quando o contato
 * ainda não tem cadastro de cliente — é o caso normal na primeira conversa.
 */
const ShowCustomerByContactService = async (
  contactId: number,
  companyId: number
): Promise<Customer | null> => {
  const customer = await Customer.findOne({
    where: { contactId, companyId },
    include: [
      { model: User, as: "responsibleUser", attributes: ["id", "name"] }
    ]
  });

  return customer;
};

export default ShowCustomerByContactService;
