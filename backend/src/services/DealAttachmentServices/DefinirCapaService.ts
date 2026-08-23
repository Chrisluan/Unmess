import AppError from "../../errors/AppError";
import DealAttachment from "../../models/DealAttachment";

interface Request {
  attachmentId: number | string;
  companyId: number;
}

/**
 * Escolhe qual arquivo representa o pedido no card do Kanban.
 *
 * Exclusivo por pedido: marcar um desmarca o anterior na mesma instrução. Duas
 * capas fariam o card escolher sozinho qual mostrar, e a escolha mudaria a cada
 * carga conforme a ordem que o banco devolvesse.
 */
const DefinirCapaService = async ({
  attachmentId,
  companyId
}: Request): Promise<DealAttachment> => {
  const anexo = await DealAttachment.findOne({
    where: { id: attachmentId, companyId }
  });

  if (!anexo) throw new AppError("ERR_NO_ATTACHMENT_FOUND", 404);

  await DealAttachment.update(
    { isPreview: false },
    { where: { dealId: anexo.dealId, companyId, isPreview: true } }
  );

  await anexo.update({ isPreview: true });

  return anexo;
};

export default DefinirCapaService;
