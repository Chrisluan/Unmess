import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import TicketStatus from "../../models/TicketStatus";

/**
 * Histórico de atendimentos de um contato, para o painel lateral do chat.
 * Limitado — é contexto rápido para o atendente, não relatório.
 */
const ListContactTicketsService = async (
  contactId: number,
  companyId: number,
  limit = 20
): Promise<Ticket[]> => {
  const tickets = await Ticket.findAll({
    where: { contactId, companyId },
    attributes: [
      "id",
      "protocol",
      "status",
      "createdAt",
      "closedAt",
      "lastMessage",
      "userId"
    ],
    include: [
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: Queue, as: "queue", attributes: ["id", "name", "color"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name"] },
      {
        model: TicketStatus,
        as: "closingStatus",
        attributes: ["id", "name", "color"]
      }
    ],
    order: [["createdAt", "DESC"]],
    limit
  });

  return tickets;
};

export default ListContactTicketsService;
