import path from "path";
import { existsSync } from "fs";

import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Sticker from "../../models/Sticker";
import uploadConfig from "../../config/upload";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";
import { logger } from "../../utils/logger";

interface Request {
  sticker: Sticker;
  ticket: Ticket;
}

/**
 * Envia uma figurinha da biblioteca para a conversa.
 *
 * Existe separado de SendWhatsAppMedia por uma diferença que parece pequena e
 * não é: lá o arquivo é descartado depois do envio, porque foi enviado uma vez
 * por um atendente. Aqui o arquivo é da biblioteca da empresa e será usado de
 * novo amanhã -- apagá-lo esvaziaria a gaveta a cada uso.
 */
const SendWhatsAppSticker = async ({
  sticker,
  ticket
}: Request): Promise<ProviderMessage> => {
  if (!ticket.whatsappId) throw new AppError("ERR_TICKET_NO_WHATSAPP");

  const arquivo = sticker.getDataValue("fileName") as string | null;
  if (!arquivo) throw new AppError("ERR_NO_STICKER_FILE");

  const caminho = path.resolve(uploadConfig.directory, arquivo);

  // A figurinha pode ter sumido do disco sem sumir do banco (limpeza manual,
  // restauração de backup). Avisar aqui é melhor que deixar o provedor falhar
  // com um erro que não diz qual figurinha faltou.
  if (!existsSync(caminho)) {
    logger.error({ info: "Figurinha ausente no disco", stickerId: sticker.id, caminho });
    throw new AppError("ERR_STICKER_FILE_MISSING");
  }

  const chatId = `${ticket.contact.number}@${ticket.isGroup ? "g" : "c"}.us`;

  try {
    const enviada = await whatsappProvider.sendMedia(
      ticket.whatsappId,
      chatId,
      {
        filename: arquivo,
        mimetype: "image/webp",
        path: caminho
      },
      { asSticker: true }
    );

    await ticket.update({ lastMessage: `🏷️ ${sticker.name}` });

    return enviada;
  } catch (err) {
    logger.error({
      info: "Erro ao enviar figurinha",
      ticketId: ticket.id,
      stickerId: sticker.id,
      err
    });
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppSticker;
