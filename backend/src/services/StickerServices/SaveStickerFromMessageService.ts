import path from "path";
import crypto from "crypto";
import { copyFile, stat } from "fs/promises";
import { existsSync } from "fs";

import Sticker from "../../models/Sticker";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import uploadConfig from "../../config/upload";
import { converterParaFigurinha } from "../../helpers/ConverterFigurinha";

interface Request {
  messageId: string;
  name: string;
  companyId: number;
}

/**
 * Guarda na biblioteca uma figurinha que o cliente mandou.
 *
 * O arquivo já está no disco -- chegou pelo WhatsApp e foi salvo junto com a
 * mensagem --, mas não pode ser apenas referenciado: apagar a conversa levaria
 * a figurinha junto, e a biblioteca ficaria com um item quebrado. Por isso o
 * arquivo é copiado, e a cópia passa a ter vida própria.
 */
const SaveStickerFromMessageService = async ({
  messageId,
  name,
  companyId
}: Request): Promise<Sticker> => {
  if (!name?.trim()) throw new AppError("ERR_STICKER_NAME_REQUIRED");

  // O join com Ticket é o que garante que a mensagem é de uma conversa desta
  // empresa; sem ele, um id adivinhado daria acesso à mídia de outra.
  const message = await Message.findOne({
    where: { id: messageId },
    include: [{ model: Ticket, as: "ticket", where: { companyId }, required: true }]
  });

  if (!message) throw new AppError("ERR_NO_MESSAGE_FOUND", 404);

  const arquivo = message.getDataValue("mediaUrl") as string | null;
  if (!arquivo) throw new AppError("ERR_MESSAGE_HAS_NO_MEDIA");

  const origem = path.resolve(uploadConfig.directory, arquivo);
  if (!existsSync(origem)) throw new AppError("ERR_STICKER_FILE_MISSING");

  const nomeFinal = `figurinha-${Date.now()}-${crypto.randomBytes(12).toString("hex")}.webp`;
  const destino = path.resolve(uploadConfig.directory, nomeFinal);

  // Uma figurinha recebida já vem no formato certo, e o conversor sabe
  // reconhecer isso e apenas copiar. Passar por ele mesmo assim cobre o caso de
  // o atendente salvar uma imagem comum da conversa como figurinha.
  const resultado = await converterParaFigurinha(origem, destino, "image/webp");

  const { size } = await stat(resultado.caminho);

  return Sticker.create({
    name: name.trim().slice(0, 60),
    fileName: nomeFinal,
    animated: resultado.animada,
    size,
    companyId
  });
};

export default SaveStickerFromMessageService;
