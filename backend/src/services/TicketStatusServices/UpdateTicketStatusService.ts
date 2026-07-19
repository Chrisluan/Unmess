import TicketStatus from "../../models/TicketStatus";
import AppError from "../../errors/AppError";

interface Request {
  id: string | number;
  name?: string;
  color?: string;
  type?: string;
  isDefault?: boolean;
  companyId: number;
}

const UpdateTicketStatusService = async ({
  id,
  name,
  color,
  type,
  isDefault,
  companyId
}: Request): Promise<TicketStatus> => {
  const status = await TicketStatus.findOne({ where: { id, companyId } });

  if (!status) {
    throw new AppError("ERR_NO_TICKET_STATUS_FOUND", 404);
  }

  if (isDefault) {
    await TicketStatus.update(
      { isDefault: false },
      { where: { companyId, type: type || status.type } }
    );
  }

  await status.update({ name, color, type, isDefault });

  return status;
};

export default UpdateTicketStatusService;
