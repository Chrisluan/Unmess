import { Transaction } from "sequelize";

import TicketStatus from "../../models/TicketStatus";
import AppError from "../../errors/AppError";

interface Request {
  id: string | number;
  name?: string;
  color?: string;
  type?: string;
  isDefault?: boolean;
  companyId: number;
  transaction?: Transaction;
}

const TIPOS = ["pending", "open", "closed"];

const UpdateTicketStatusService = async ({
  id,
  name,
  color,
  type,
  isDefault,
  companyId,
  transaction
}: Request): Promise<TicketStatus> => {
  const status = await TicketStatus.findOne({ where: { id, companyId }, transaction });

  if (!status) {
    throw new AppError("ERR_NO_TICKET_STATUS_FOUND", 404);
  }

  // A criação já validava o tipo; a edição aceitava qualquer texto, e um
  // motivo com tipo inventado sumia de todo filtro que procura "closed".
  if (type !== undefined && !TIPOS.includes(type)) {
    throw new AppError("ERR_TICKET_STATUS_INVALID_TYPE", 400);
  }

  if (isDefault) {
    await TicketStatus.update(
      { isDefault: false },
      { where: { companyId, type: type || status.type }, transaction }
    );
  }

  await status.update({ name, color, type, isDefault }, { transaction });

  return status;
};

export default UpdateTicketStatusService;
