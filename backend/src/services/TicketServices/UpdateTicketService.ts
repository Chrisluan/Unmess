import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import GetDefaultQueue from "../../helpers/GetDefaultQueue";
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
  userId?: number | null;
  queueId?: number | null;
  whatsappId?: number;
  closingStatusId?: number;
  // Flags explícitas de remoção, usadas pelo modal de transferência para
  // diferenciar "não mexer nesse campo" (undefined) de "remover" (null).
  removeUser?: boolean;
  removeQueue?: boolean;
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
  const {
    status,
    whatsappId,
    closingStatusId,
    removeUser,
    removeQueue
  } = ticketData;

  // userId/queueId: undefined = não mexe; null ou removeX = true = limpa de
  // verdade. O Sequelize ignora chaves `undefined` num update(), então sem
  // essa normalização explícita nunca é possível remover o atendente/setor
  // de um ticket (era a causa da transferência ficar "presa" ao atendente
  // anterior).
  let { userId, queueId } = ticketData;
  if (removeUser) userId = null;
  if (removeQueue) queueId = null;

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

  // Nunca deixa o ticket órfão de setor: se a transferência removeu a fila
  // (ou tirou o atendente sem indicar outra fila) e não sobrou nenhum
  // setor, cai automaticamente no setor marcado como padrão.
  const resultingQueueId = queueId !== undefined ? queueId : oldQueueId;
  if (!resultingQueueId && companyId) {
    const defaultQueue = await GetDefaultQueue(companyId);
    if (defaultQueue) {
      queueId = defaultQueue.id;
    }
  }

  // Métricas: registra o instante em que o atendimento passa a ter um
  // atendente humano de fato (primeira resposta) e o instante de fechamento.
  const metricsUpdate: { firstResponseAt?: Date; closedAt?: Date } = {};
  if (userId && !ticket.firstResponseAt) {
    metricsUpdate.firstResponseAt = new Date();
  }

  const updatePayload: Record<string, unknown> = {
    status,
    closingStatusId,
    ...metricsUpdate
  };
  if (userId !== undefined) updatePayload.userId = userId;
  if (queueId !== undefined) updatePayload.queueId = queueId;

  // Ao finalizar o atendimento: some das filas ativas (Meus / Em
  // Atendimento / Aguardando), mas SEM apagar nada — mensagens, contato e o
  // próprio ticket continuam intactos no banco para consulta de histórico
  // e dashboard. Também libera o atendente/setor para que o próximo
  // atendimento desse contato comece "do zero" no roteamento.
  if (status === "closed" && oldStatus !== "closed") {
    metricsUpdate.closedAt = new Date();
    updatePayload.closedAt = metricsUpdate.closedAt;
    updatePayload.userId = null;
    updatePayload.queueId = null;
  }

  await ticket.update(updatePayload);

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
    ((updatePayload.userId !== undefined && updatePayload.userId !== oldUserId) ||
      (updatePayload.queueId !== undefined && updatePayload.queueId !== oldQueueId));

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
