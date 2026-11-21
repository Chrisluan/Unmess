import { getIO } from "../../libs/socket";
import {
  companyRoom,
  notificationRoom,
  statusRoom,
  ticketRoom
} from "../../libs/socketRooms";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";

interface MessageData {
  id: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  quotedMsgId?: string;
  fromApp?: boolean;
  timestamp?: Date;
}
interface Request {
  messageData: MessageData;
}

const CreateMessageService = async ({
  messageData
}: Request): Promise<Message> => {
  // O eco da própria mensagem costuma chegar depois da confirmação de
  // entrega ou leitura. Gravando o ack que veio no eco, a mensagem já lida
  // voltava para "enviada" na tela. Os estados só avançam.
  const existente = await Message.findByPk(messageData.id, {
    attributes: ["id", "ack"]
  });

  const dados =
    existente && (messageData.ack ?? 0) < (existente.ack ?? 0)
      ? { ...messageData, ack: existente.ack }
      : messageData;

  await Message.upsert(dados);

  const message = await Message.findByPk(messageData.id, {
    include: [
      "contact",
      {
        // Este ticket vai inteiro para a lista de conversas pelo socket, e lá
        // substitui a linha que já estava na tela. Faltando "user" e "tags",
        // toda mensagem nova apagava da linha o responsável e as etiquetas
        // até a próxima recarga.
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          "queue",
          "user",
          "tags",
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  const io = getIO();
  const empresa = message.ticket.companyId;

  io.to(companyRoom(empresa))
    .to(ticketRoom(empresa, message.ticketId))
    .to(statusRoom(empresa, message.ticket.status))
    .to(notificationRoom(empresa))
    .emit("appMessage", {
      action: "create",
      message,
      ticket: message.ticket,
      contact: message.ticket.contact
    });

  return message;
};

export default CreateMessageService;
