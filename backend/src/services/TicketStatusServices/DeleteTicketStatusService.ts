import { Transaction } from "sequelize";

import TicketStatus from "../../models/TicketStatus";
import AppError from "../../errors/AppError";

const DeleteTicketStatusService = async (
  id: string,
  companyId: number,
  transaction?: Transaction
): Promise<void> => {
  const status = await TicketStatus.findOne({ where: { id, companyId }, transaction });

  if (!status) {
    throw new AppError("ERR_NO_TICKET_STATUS_FOUND", 404);
  }

  await status.destroy({ transaction });
};

export default DeleteTicketStatusService;
