import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { whatsappProvider } from "../../providers/WhatsApp";

const EditWhatsAppMessage = async (
  messageId: string,
  body: string,
  companyId: number
): Promise<Message> => {
  const message = await Message.findByPk(messageId, {
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new AppError("No message found with this ID.");
  }

  const { ticket } = message;

  if (ticket.companyId !== companyId) {
    throw new AppError("No message found with this ID.");
  }

  // Nota interna nunca chegou ao WhatsApp, então não há o que reescrever lá.
  if (message.isInternal) {
    throw new AppError("ERR_EDIT_INTERNAL_NOTE");
  }

  if (!message.fromMe) {
    throw new AppError("ERR_EDIT_ONLY_OWN_MESSAGE");
  }

  if (message.isDeleted) {
    throw new AppError("ERR_EDIT_DELETED_MESSAGE");
  }

  // Editar mídia trocaria só a legenda e daria a impressão de que o arquivo
  // mudou; o WhatsApp também não permite substituir o anexo.
  if (message.mediaUrl) {
    throw new AppError("ERR_EDIT_MEDIA_MESSAGE");
  }

  const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

  await whatsappProvider.editMessage(
    ticket.whatsappId,
    chatId,
    message.id,
    body
  );

  await message.update({ body, isEdited: true });

  return message;
};

export default EditWhatsAppMessage;
