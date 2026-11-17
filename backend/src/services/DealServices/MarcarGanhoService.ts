import Deal from "../../models/Deal";
import DealActivity from "../../models/DealActivity";

interface Request {
  deal: Deal;
  companyId: number;
  userId?: number;
  /** Nome da coluna ou quadro que fechou a venda, para a timeline. */
  origem?: string;
}

/**
 * Marca como ganho o card que cruzou a coluna de ganho.
 *
 * **Um card, um faturamento.** Uma versão anterior marcava só uma vez por
 * jornada (`rootDealId`), no medo de que a mesma venda fosse contada uma vez
 * por quadro percorrido. Duas coisas derrubam esse raciocínio:
 *
 * 1. A jornada **se ramifica**. Um orçamento aprovado abre vários cards no
 *    quadro seguinte -- pedaços diferentes do mesmo trabalho, cada um com seu
 *    valor, cada um chegando ao faturamento por conta própria. Contar um só
 *    fazia o segundo em diante entrar mudo: o card ia para "Faturado" e o
 *    número no topo não se mexia.
 * 2. O medo não se realizava. `wonAt` só é gravado ao cruzar uma coluna
 *    marcada como ganho (ou ao terminar a fila de quadros), e num fluxo há uma
 *    dessas -- percorrer Vendas → Arte → Produção → Expedição não passa por
 *    nenhuma outra.
 *
 * A proteção que sobra é contra o mesmo card faturar duas vezes: arrastar para
 * fora da coluna e de volta não regrava a data.
 *
 * Devolve `true` só quando marcou de fato -- quem chama usa isso para não
 * repetir o registro na timeline.
 */
const MarcarGanhoService = async ({
  deal,
  companyId,
  userId,
  origem
}: Request): Promise<boolean> => {
  if (deal.wonAt) return false;

  await deal.update({ wonAt: new Date() });

  await DealActivity.create({
    type: "won",
    body: origem || null,
    dealId: deal.id,
    userId: userId || null,
    companyId
  });

  return true;
};

export default MarcarGanhoService;
