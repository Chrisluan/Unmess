import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import ShowContactService from "../ContactServices/ShowContactService";
import { ensureProtocol } from "../../helpers/BuildTicketProtocol";

interface Request {
  contactId: number;
  status: string;
  userId: number;
  companyId: number;
  queueId?: number;
  /** Conexão escolhida pelo atendente. Se omitido, resolve pela ordem padrão. */
  whatsappId?: number;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  companyId,
  queueId,
  whatsappId
}: Request): Promise<Ticket> => {
  const whatsapp = await GetDefaultWhatsApp(companyId, userId, whatsappId);

  await CheckContactOpenTickets(contactId, whatsapp.id);

  const { isGroup } = await ShowContactService(contactId, companyId);

  if (queueId === undefined) {
    const user = await User.findByPk(userId, { include: ["queues"] });
    queueId = user?.queues.length === 1 ? user.queues[0].id : undefined;
  }

  const { id }: Ticket = await whatsapp.$create("ticket", {
    contactId,
    status,
    isGroup,
    userId,
    queueId,
    companyId
  });

  const ticket = await Ticket.findByPk(id, {
    include: ["contact", "whatsapp"]
  });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  await ensureProtocol(ticket);

  return ticket;
};

export default CreateTicketService;
