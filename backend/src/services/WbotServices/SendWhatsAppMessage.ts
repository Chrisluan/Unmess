import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";
import { logger } from "../../utils/logger";

import formatBody from "../../helpers/Mustache";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<ProviderMessage> => {
  if (!ticket.whatsappId) {
    throw new AppError("ERR_TICKET_NO_WHATSAPP");
  }

  const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

  try {
    const sentMessage = await whatsappProvider.sendMessage(
      ticket.whatsappId,
      chatId,
      formatBody(body, ticket.contact),
      {
        quotedMessageId: quotedMsg?.id,
        quotedMessageFromMe: quotedMsg?.fromMe,
        linkPreview: false
      }
    );

    await ticket.update({ lastMessage: body, lastMessageFromMe: true });
    return sentMessage;
  } catch (err) {
    logger.error(
      {
        err,
        ticketId: ticket.id,
        whatsappId: ticket.whatsappId,
        chatId,
        contactNumber: ticket.contact?.number,
        contactLid: (ticket.contact as any)?.lid
      },
      "Error sending WhatsApp message"
    );

    // Sessão caída, número inválido: esses erros já dizem o que houve, e
    // trocá-los por um "erro ao enviar" genérico apagava justamente a
    // informação que o atendente precisa para saber se adianta tentar de
    // novo ou se é a conexão que precisa ser religada.
    if (err instanceof AppError) throw err;

    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;