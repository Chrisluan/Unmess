import fs from "fs";
import path from "path";

import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import uploadConfig from "../../config/upload";
import { whatsappProvider } from "../../providers/WhatsApp";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowTicketService from "../TicketServices/ShowTicketService";
import CreateTicketService from "../TicketServices/CreateTicketService";
import ShowContactService from "../ContactServices/ShowContactService";
import { logger } from "../../utils/logger";

// Mapa mínimo de extensão → mimetype. Evita depender de "mime-types", que
// hoje só existe como dependência transitiva e sem @types no projeto.
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".3gp": "video/3gpp",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".txt": "text/plain"
};

const guessMimetype = (filePath: string): string =>
  MIME_BY_EXT[path.extname(filePath).toLowerCase()] ||
  "application/octet-stream";

interface Request {
  messageId: string;
  /** Encaminhar para um chat já existente. */
  toTicketId?: number;
  /** Ou para um contato — abre/reaproveita um chat com ele. */
  toContactId?: number;
  userId: number;
  companyId: number;
}

/**
 * Encaminha uma mensagem para outro chat.
 *
 * Reenvia o conteúdo em vez de usar o "forward" nativo do WhatsApp: os
 * providers (wwebjs/baileys) expõem forward de formas diferentes e nem
 * sempre com a mídia já baixada. Reenviar funciona igual nos dois.
 */
const ForwardMessageService = async ({
  messageId,
  toTicketId,
  toContactId,
  userId,
  companyId
}: Request): Promise<Ticket> => {
  const message = await Message.findByPk(messageId, {
    include: [{ model: Ticket, as: "ticket", attributes: ["id", "companyId"] }]
  });

  if (!message) {
    throw new AppError("ERR_NO_MESSAGE_FOUND", 404);
  }

  if (message.ticket?.companyId !== companyId) {
    throw new AppError("ERR_NO_MESSAGE_FOUND", 404);
  }

  if (message.isInternal) {
    throw new AppError("ERR_CANNOT_FORWARD_INTERNAL_NOTE", 400);
  }

  let targetTicket: Ticket;

  if (toTicketId) {
    targetTicket = await ShowTicketService(toTicketId, companyId);
  } else if (toContactId) {
    const contact = await ShowContactService(toContactId, companyId);

    // Reaproveita chat aberto/pendente do contato; só cria um novo se não houver.
    const existing = await Ticket.findOne({
      where: { contactId: contact.id, companyId },
      order: [["updatedAt", "DESC"]],
      include: [{ model: Contact, as: "contact" }]
    });

    if (existing && ["open", "pending"].includes(existing.status)) {
      targetTicket = await ShowTicketService(existing.id, companyId);
    } else {
      const created = await CreateTicketService({
        contactId: contact.id,
        status: "open",
        userId,
        companyId
      });
      targetTicket = await ShowTicketService(created.id, companyId);
    }
  } else {
    throw new AppError("ERR_FORWARD_NO_TARGET", 400);
  }

  // mediaUrl é um getter que devolve URL completa; o nome do arquivo em disco
  // está no valor cru da coluna.
  const mediaFileName = message.getDataValue("mediaUrl") as string | null;

  if (mediaFileName) {
    const filePath = path.resolve(uploadConfig.directory, mediaFileName);

    if (!fs.existsSync(filePath)) {
      logger.warn(
        `Forward: mídia ${mediaFileName} não está mais em disco; encaminhando só o texto.`
      );
      if (message.body) {
        await SendWhatsAppMessage({ body: message.body, ticket: targetTicket });
      }
      return targetTicket;
    }

    const chatId = `${targetTicket.contact.number}@${
      targetTicket.isGroup ? "g" : "c"
    }.us`;

    await whatsappProvider.sendMedia(
      targetTicket.whatsappId,
      chatId,
      {
        filename: mediaFileName,
        mimetype: guessMimetype(filePath),
        path: filePath
      },
      {
        // O corpo de uma mensagem de mídia costuma ser o nome do arquivo;
        // nesse caso não vale a pena repetir como legenda.
        caption: message.body === mediaFileName ? undefined : message.body,
        sendAudioAsVoice: message.mediaType === "audio",
        sendMediaAsDocument: message.mediaType === "document"
      }
    );

    await targetTicket.update({ lastMessage: message.body || mediaFileName });

    return targetTicket;
  }

  if (!message.body) {
    throw new AppError("ERR_EMPTY_MESSAGE_TO_FORWARD", 400);
  }

  await SendWhatsAppMessage({ body: message.body, ticket: targetTicket });

  return targetTicket;
};

export default ForwardMessageService;
