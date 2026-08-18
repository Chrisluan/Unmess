import Deal from "../../models/Deal";
import Ticket from "../../models/Ticket";
import DealTicket from "../../models/DealTicket";
import AppError from "../../errors/AppError";
import ShowDealService from "./ShowDealService";

interface Request {
  dealId: string | number;
  ticketId: number;
  companyId: number;
  // false desfaz o vínculo
  link?: boolean;
}

/**
 * Liga (ou desliga) uma conversa de WhatsApp ao negócio, para o histórico
 * comercial apontar para o atendimento que o gerou.
 */
const LinkDealTicketService = async ({
  dealId,
  ticketId,
  companyId,
  link = true
}: Request): Promise<Deal> => {
  const deal = await Deal.findOne({ where: { id: dealId, companyId } });

  if (!deal) {
    throw new AppError("ERR_NO_DEAL_FOUND", 404);
  }

  const ticket = await Ticket.findOne({ where: { id: ticketId, companyId } });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  if (link) {
    await DealTicket.findOrCreate({
      where: { dealId: deal.id, ticketId: ticket.id }
    });
  } else {
    await DealTicket.destroy({
      where: { dealId: deal.id, ticketId: ticket.id }
    });
  }

  return ShowDealService(deal.id, companyId);
};

export default LinkDealTicketService;
