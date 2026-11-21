import Customer from "../../models/Customer";
import Ticket from "../../models/Ticket";

export interface ClienteDoTicket {
  contactId: number | null;
  customerId: number | null;
}

/**
 * Quem é o cliente de um atendimento, na forma que o negócio guarda.
 *
 * O card do CRM nascia sem contato e sem cliente quando era criado a partir
 * da conversa: a tela mandava só o título e o ticket, e o negócio ficava com
 * as duas chaves nulas. No quadro isso aparecia como um card sem nome — o
 * atendente via "Camiseta 20un" e não tinha como saber de quem era sem abrir.
 *
 * A ligação existe pelo contato do WhatsApp: o cadastro de cliente aponta
 * para ele. Quando não há cadastro, o contato sozinho já basta para o card se
 * identificar.
 */
const clienteDoTicket = async (
  ticket: Ticket,
  companyId: number
): Promise<ClienteDoTicket> => {
  const contactId = ticket.contactId || null;

  if (!contactId) return { contactId: null, customerId: null };

  const customer = await Customer.findOne({
    where: { contactId, companyId },
    attributes: ["id"]
  });

  return { contactId, customerId: customer?.id || null };
};

export default clienteDoTicket;
