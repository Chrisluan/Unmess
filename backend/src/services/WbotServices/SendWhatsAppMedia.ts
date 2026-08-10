import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import convertToVoiceNote from "../../helpers/ConvertToVoiceNote";
import Ticket from "../../models/Ticket";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";

import formatBody from "../../helpers/Mustache";
import { logger } from "../../utils/logger";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body
}: Request): Promise<ProviderMessage> => {
  try {
    if (!ticket.whatsappId) {
      throw new AppError("ERR_TICKET_NO_WHATSAPP");
    }

    const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

    const hasBody = body
      ? formatBody(body as string, ticket.contact)
      : undefined;

    // Áudio vira mensagem de voz, e o WhatsApp só aceita Ogg/Opus nesse papel.
    // O navegador entrega WebM/Opus, então o contêiner precisa ser trocado
    // antes do envio.
    const ehAudio = media.mimetype.startsWith("audio/");
    const audio = ehAudio ? await convertToVoiceNote(media.path) : null;

    const mediaInput = {
      filename: audio?.convertido
        ? path.basename(audio.path)
        : media.filename,
      mimetype: audio ? audio.mimetype : media.mimetype,
      path: audio ? audio.path : media.path
    };

    const mediaOptions = {
      caption: hasBody,
      sendAudioAsVoice: true,
      sendMediaAsDocument:
        media.mimetype.startsWith("image/") &&
        !/^.*\.(jpe?g|png|gif)?$/i.exec(media.filename)
    };

    const sentMessage = await whatsappProvider.sendMedia(
      ticket.whatsappId,
      chatId,
      mediaInput,
      mediaOptions
    );

    await ticket.update({ lastMessage: body || media.filename });

    // Apaga o arquivo efetivamente enviado: quando houve conversão, o
    // original já foi removido e media.path não existe mais.
    fs.unlinkSync(mediaInput.path);

    return sentMessage;
  } catch (err) {
    // console.log engolia o contexto: sem saber o arquivo e o mimetype, o
    // erro no log não dizia por que a mídia foi recusada.
    logger.error({
      info: "Error sending WhatsApp media",
      ticketId: ticket.id,
      filename: media?.filename,
      mimetype: media?.mimetype,
      tamanho: media?.size,
      err
    });
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
