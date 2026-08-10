import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";

interface Request {
  contactId: string | number;
  companyId: number;
  isKnown: boolean;
}

/**
 * Marca ou desmarca um contato como pessoa conhecida.
 *
 * Endpoint próprio em vez de reaproveitar a atualização de contato: aquela
 * valida o número contra o WhatsApp a cada chamada, o que é caro demais para
 * um interruptor de uma tecla.
 */
const ToggleKnownContactService = async ({
  contactId,
  companyId,
  isKnown
}: Request): Promise<Contact> => {
  const contact = await Contact.findOne({
    where: { id: contactId, companyId }
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  await contact.update({ isKnown });

  if (isKnown) {
    // Os atendimentos que o contato já tinha continuariam pendentes, pedindo
    // aceite — exatamente o que marcar como conhecido deveria evitar. Abre e
    // solta o dono para qualquer atendente responder.
    await Ticket.update(
      { status: "open", userId: null },
      { where: { contactId: contact.id, companyId, status: "pending" } }
    );
  }

  return contact;
};

export default ToggleKnownContactService;
