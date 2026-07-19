import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import Setting from "../../models/Setting";
import formatBody from "../../helpers/Mustache";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowTicketService from "./ShowTicketService";
import { logger } from "../../utils/logger";

interface TicketData {
  status?: string;
  userId?: number;
  queueId?: number;
  whatsappId?: number;
  closingStatusId?: number;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
  companyId?: number;
  isTransfer?: boolean;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const UpdateTicketService = async ({
  ticketData,
  ticketId,
  companyId,
  isTransfer = false
}: Request): Promise<Response> => {
  const { status, userId, queueId, whatsappId, closingStatusId } = ticketData;

  const ticket = await ShowTicketService(ticketId, companyId);
  await SetTicketMessagesAsRead(ticket);

  if (whatsappId && ticket.whatsappId !== whatsappId) {
    await CheckContactOpenTickets(ticket.contactId, whatsappId);
  }

  const oldStatus = ticket.status;
  const oldUserId = ticket.user?.id;
  const oldQueueId = ticket.queueId;

  if (oldStatus === "closed") {
    await CheckContactOpenTickets(ticket.contact.id, ticket.whatsappId);
  }

  // Métricas: registra o instante em que o atendimento passa a ter um
  // atendente humano de fato (primeira resposta) e o instante de fechamento.
  const metricsUpdate: { firstResponseAt?: Date; closedAt?: Date } = {};
  if (userId && !ticket.firstResponseAt) {
    metricsUpdate.firstResponseAt = new Date();
  }
  if (status === "closed" && oldStatus !== "closed") {
    metricsUpdate.closedAt = new Date();
  }

  await ticket.update({
    status,
    queueId,
    userId,
    closingStatusId,
    ...metricsUpdate
  });

  if (whatsappId) {
    await ticket.update({
      whatsappId
    });
  }

  await ticket.reload();

  // Mensagem de transferência: só dispara em transferências reais (feitas
  // por um atendente movendo o chat), nunca na atribuição automática inicial
  // do bot, e apenas se o admin habilitou essa automação nas configurações.
  const wasTransferred =
    isTransfer &&
    ((userId && userId !== oldUserId) || (queueId && queueId !== oldQueueId));

  if (wasTransferred && ticket.companyId) {
    try {
      const transferSetting = await Setting.findOne({
        where: { key: "transferMessageEnabled", companyId: ticket.companyId }
      });

      if (transferSetting?.value === "enabled") {
        const messageSetting = await Setting.findOne({
          where: { key: "transferMessage", companyId: ticket.companyId }
        });

        if (messageSetting?.value) {
          await SendWhatsAppMessage({
            body: formatBody(messageSetting.value, ticket),
            ticket
          });
        }
      }
    } catch (error) {
      logger.error("Error sending transfer message:", error);
    }
  }

  const io = getIO();

  if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
    io.to(`company-${ticket.companyId}`).to(oldStatus).emit("ticket", {
      action: "delete",
      ticketId: ticket.id
    });
  }

  io.to(`company-${ticket.companyId}`)
    .to(ticket.status)
    .to("notification")
    .to(ticketId.toString())
    .emit("ticket", {
      action: "update",
      ticket
    });

  return { ticket, oldStatus, oldUserId };
};

export default UpdateTicketService;
