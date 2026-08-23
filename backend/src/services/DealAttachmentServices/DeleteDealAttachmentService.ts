import fs from "fs/promises";
import path from "path";

import AppError from "../../errors/AppError";
import DealAttachment from "../../models/DealAttachment";
import uploadConfig from "../../config/upload";
import { logger } from "../../utils/logger";

interface Request {
  attachmentId: number | string;
  companyId: number;
}

/**
 * Remove um material do pedido, e o arquivo junto.
 *
 * Deixar o arquivo em /public depois de excluído o registro criaria lixo que
 * ninguém mais alcança pela tela mas continua servido por link direto.
 *
 * Se o pedido perde a capa, a imagem mais recente assume: o card não pode
 * voltar a ser um retângulo de texto só porque alguém apagou a arte antiga.
 */
const DeleteDealAttachmentService = async ({
  attachmentId,
  companyId
}: Request): Promise<void> => {
  const anexo = await DealAttachment.findOne({
    where: { id: attachmentId, companyId }
  });

  if (!anexo) throw new AppError("ERR_NO_ATTACHMENT_FOUND", 404);

  const { dealId, isPreview } = anexo;
  const nomeEmDisco = path.basename(anexo.fileName || "");

  await anexo.destroy();

  if (nomeEmDisco) {
    try {
      await fs.unlink(path.resolve(uploadConfig.directory, nomeEmDisco));
    } catch (err) {
      // O registro já saiu; um arquivo ausente ou em uso não é motivo para a
      // exclusão falhar na cara de quem clicou.
      logger.warn({ info: "Falha ao apagar material do pedido", nomeEmDisco });
    }
  }

  if (!isPreview) return;

  const proxima = await DealAttachment.findOne({
    where: { dealId, companyId },
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ]
  });

  if (proxima && String(proxima.mimetype || "").startsWith("image/")) {
    await proxima.update({ isPreview: true });
  }
};

export default DeleteDealAttachmentService;
