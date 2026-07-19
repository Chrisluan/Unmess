import * as Yup from "yup";
import AppError from "../../errors/AppError";
import TicketStatus from "../../models/TicketStatus";

interface Request {
  name: string;
  color?: string;
  type?: string;
  isDefault?: boolean;
  companyId: number;
}

const CreateTicketStatusService = async ({
  name,
  color,
  type = "closed",
  isDefault = false,
  companyId
}: Request): Promise<TicketStatus> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    type: Yup.string().oneOf(["pending", "open", "closed"])
  });

  try {
    await schema.validate({ name, type });
  } catch (err) {
    throw new AppError(err.message);
  }

  if (isDefault) {
    await TicketStatus.update(
      { isDefault: false },
      { where: { companyId, type } }
    );
  }

  const status = await TicketStatus.create({
    name,
    color,
    type,
    isDefault,
    companyId
  });

  return status;
};

export default CreateTicketStatusService;
