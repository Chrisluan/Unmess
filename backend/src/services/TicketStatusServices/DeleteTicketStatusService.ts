import TicketStatus from "../../models/TicketStatus";
import AppError from "../../errors/AppError";

const DeleteTicketStatusService = async (
  id: string,
  companyId: number
): Promise<void> => {
  const status = await TicketStatus.findOne({ where: { id, companyId } });

  if (!status) {
    throw new AppError("ERR_NO_TICKET_STATUS_FOUND", 404);
  }

  await status.destroy();
};

export default DeleteTicketStatusService;
