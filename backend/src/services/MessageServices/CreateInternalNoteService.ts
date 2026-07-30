import { v4 as uuidv4 } from "uuid";

import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import User from "../../models/User";
import { getIO } from "../../libs/socket";
import ShowTicketService from "../TicketServices/ShowTicketService";

interface Request {
  ticketId: string | number;
  body: string;
  userId: number;
  companyId: number;
}

/**
 * Nota interna: registrada como mensagem do chat (para aparecer na linha do
 * tempo na ordem certa), mas com isInternal = true. Nada é enviado ao WhatsApp.
 */
const CreateInternalNoteService = async ({
  ticketId,
  body,
  userId,
  companyId
}: Request): Promise<Message> => {
  if (!body || !body.trim()) {
    throw new AppError("ERR_EMPTY_INTERNAL_NOTE", 400);
  }

  const ticket = await ShowTicketService(ticketId, companyId);

  // id da tabela Messages é string (vem do WhatsApp). Notas internas não têm
  // origem no WhatsApp, então geramos um id próprio com prefixo identificável.
  const id = `note_${uuidv4()}`;

  await Message.create({
    id,
    ticketId: ticket.id,
    body: body.trim(),
    fromMe: true,
    read: true,
    isInternal: true,
    userId,
    ack: 0
  });

  const message = await Message.findByPk(id, {
    include: [
      "contact",
      { model: User, as: "user", attributes: ["id", "name"] }
    ]
  });

  if (!message) {
    throw new AppError("ERR_CREATING_MESSAGE");
  }

  // Não atualiza unreadMessages nem lastMessage: nota interna não é
  // interação do cliente e não deve reordenar/realçar a lista de chats.
  const io = getIO();
  io.to(`company-${companyId}`)
    .to(ticket.id.toString())
    .emit("appMessage", {
      action: "create",
      message,
      ticket,
      contact: ticket.contact
    });

  return message;
};

export default CreateInternalNoteService;
