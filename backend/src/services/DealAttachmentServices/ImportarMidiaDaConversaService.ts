import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import DealAttachment from "../../models/DealAttachment";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import uploadConfig from "../../config/upload";
import CreateDealAttachmentService from "./CreateDealAttachmentService";

interface Request {
  dealId: number | string;
  messageId: string;
  companyId: number;
  userId?: number;
}

/**
 * Traz uma mídia da conversa para o material do pedido.
 *
 * O arquivo é **copiado**, não referenciado. A mídia pertence à conversa: quem
 * apaga uma mensagem no chat não está dizendo que a arte aprovada deixou de
 * valer, e o pedido não pode ficar sem ela por causa disso. O custo é um
 * arquivo a mais em disco; o custo do contrário é reabrir o WhatsApp para
 * descobrir o que era para ser impresso.
 */
const ImportarMidiaDaConversaService = async ({
  dealId,
  messageId,
  companyId,
  userId
}: Request): Promise<DealAttachment> => {
  const deal = await Deal.findOne({ where: { id: dealId, companyId } });

  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  // O ticket entra no join para a empresa da mensagem ser conferida: sem isso,
  // um id de mensagem de outra empresa traria a mídia dela para cá.
  const message = await Message.findOne({
    where: { id: messageId },
    include: [{ model: Ticket, as: "ticket", attributes: ["id", "companyId"] }]
  });

  if (!message || message.ticket?.companyId !== companyId) {
    throw new AppError("ERR_NO_MESSAGE_FOUND", 404);
  }

  // O getter devolve "/public/arquivo.ext"; o disco guarda só o nome.
  const caminhoRelativo = message.mediaUrl;

  if (!caminhoRelativo) {
    throw new AppError("ERR_MESSAGE_HAS_NO_MEDIA", 400);
  }

  const nomeEmDisco = path.basename(caminhoRelativo);
  const origem = path.resolve(uploadConfig.directory, nomeEmDisco);

  // path.basename já impede subir de pasta, mas a conferência explícita é o
  // que garante isso mesmo se o formato guardado mudar um dia.
  if (path.dirname(origem) !== path.resolve(uploadConfig.directory)) {
    throw new AppError("ERR_INVALID_MEDIA_PATH", 400);
  }

  let tamanho = 0;

  try {
    const info = await fs.stat(origem);
    tamanho = info.size;
  } catch {
    throw new AppError("ERR_MEDIA_FILE_MISSING", 404);
  }

  const extensao = path.extname(nomeEmDisco).toLowerCase();
  const destinoNome = `${Date.now()}-${crypto
    .randomBytes(16)
    .toString("hex")}${extensao}`;

  await fs.copyFile(origem, path.resolve(uploadConfig.directory, destinoNome));

  const [criado] = await CreateDealAttachmentService({
    dealId: deal.id,
    companyId,
    userId,
    sourceMessageId: message.id,
    arquivos: [
      {
        // O nome original não sobrevive à mídia do WhatsApp; o corpo da
        // mensagem costuma ser a legenda, e é o que mais se parece com um nome.
        originalname: message.body?.trim() || nomeEmDisco,
        filename: destinoNome,
        mimetype: message.mediaType?.includes("/")
          ? message.mediaType
          : tipoPorExtensao(extensao),
        size: tamanho
      }
    ]
  });

  return criado;
};

/**
 * O `mediaType` gravado pelo WhatsApp é a categoria ("image", "document"), não
 * o mimetype. A extensão do arquivo é o que resta para saber se dá para mostrar
 * como miniatura.
 */
const tipoPorExtensao = (extensao: string): string => {
  const mapa: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg"
  };

  return mapa[extensao] || "application/octet-stream";
};

export default ImportarMidiaDaConversaService;
