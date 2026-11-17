import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import DealAttachment from "../../models/DealAttachment";
import User from "../../models/User";

interface Request {
  dealId: number | string;
  companyId: number;
}

/**
 * O material de um pedido.
 *
 * A capa vem primeiro, e depois os mais recentes: quem abre a aba quer ver a
 * arte escolhida antes de qualquer coisa, e o que chegou por último logo em
 * seguida.
 */
const ListDealAttachmentsService = async ({
  dealId,
  companyId
}: Request): Promise<DealAttachment[]> => {
  const deal = await Deal.findOne({ where: { id: dealId, companyId } });

  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  return DealAttachment.findAll({
    where: { dealId: deal.id, companyId },
    include: [
      { model: User, as: "uploadedBy", attributes: ["id", "name"], required: false }
    ],
    order: [
      ["isPreview", "DESC"],
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ]
  });
};

export default ListDealAttachmentsService;
