import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";

const DeleteTicketService = async (
  id: string,
  companyId?: number
): Promise<Ticket> => {
  const where: { id: string; companyId?: number } = { id };
  if (companyId !== undefined) {
    where.companyId = companyId;
  }

  const ticket = await Ticket.findOne({
    where
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  await ticket.destroy();

  return ticket;
};

export default DeleteTicketService;
