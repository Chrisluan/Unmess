import { Op } from "sequelize";
import Deal from "../../models/Deal";
import AppError from "../../errors/AppError";

/**
 * Exclui o negócio inteiro, não apenas o card visível.
 *
 * Como cada quadro concluído gera um card novo, um negócio é uma cadeia de
 * cards. Apagar só o card da frente deixaria os anteriores no banco contando
 * como vendas soltas no resumo — por isso a exclusão pega a jornada toda,
 * inclusive quando quem foi clicado é um card do meio do caminho.
 */
const DeleteDealService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const deal = await Deal.findOne({ where: { id, companyId } });

  if (!deal) {
    throw new AppError("ERR_NO_DEAL_FOUND", 404);
  }

  const raiz = deal.rootDealId || deal.id;

  const cadeia = await Deal.findAll({
    where: {
      companyId,
      [Op.or]: [{ id: raiz }, { rootDealId: raiz }]
    }
  });

  // Os derivados saem antes da raiz: apagar a raiz primeiro dispara o cascade
  // e some com a lista debaixo dos pés.
  const derivados = cadeia.filter(item => item.id !== raiz);

  for (const item of derivados) {
    await item.destroy();
  }

  await Deal.destroy({ where: { id: raiz, companyId } });

  // A posição liberada pelo card ativo é fechada para os próximos arrastos não
  // calcularem posição sobre uma sequência furada.
  const ativo = cadeia.find(item => item.status !== "moved");

  if (ativo) {
    await Deal.increment("order", {
      by: -1,
      where: {
        companyId,
        stageId: ativo.stageId,
        status: "open",
        order: { [Op.gt]: ativo.order }
      }
    });
  }
};

export default DeleteDealService;
