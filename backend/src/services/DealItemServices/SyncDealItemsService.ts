import { Op } from "sequelize";
import DealItem from "../../models/DealItem";
import Deal from "../../models/Deal";
import AppError from "../../errors/AppError";
import { pedidoAtivoDo } from "../OrderServices/GerarPedidoService";

export interface ItemEntrada {
  id?: number;
  description: string;
  quantity?: number | string;
  unit?: string;
  unitPrice?: number | string;
  discount?: number | string;
  notes?: string;
  productId?: number | null;
  width?: number | string;
  height?: number | string;
  pricingMode?: string;
  minMeasure?: number | string;
}

interface Request {
  dealId: number | string;
  companyId: number;
  items: ItemEntrada[];
}

const numero = (valor: unknown, padrao = 0): number => {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : padrao;
};

/**
 * Normaliza a lista que veio da tela. Usada também pelos itens do pedido:
 * orçamento e pedido têm de aceitar exatamente as mesmas linhas.
 */
export const limparItens = (items: ItemEntrada[]) =>
  items
    .filter(item => item?.description?.trim())
    .map((item, indice) => ({
      id: item.id,
      description: item.description.trim().slice(0, 255),
      quantity: numero(item.quantity, 1),
      unit: (item.unit || "un").trim().slice(0, 12) || "un",
      unitPrice: numero(item.unitPrice, 0),
      discount: numero(item.discount, 0),
      notes: item.notes?.trim() || null,
      productId: item.productId || null,
      width: numero(item.width, 0),
      height: numero(item.height, 0),
      // Modo desconhecido cai em unidade: melhor cobrar por peça do que
      // multiplicar por uma medida que ninguém preencheu.
      pricingMode: ["area", "linear"].includes(String(item.pricingMode))
        ? String(item.pricingMode)
        : "unit",
      minMeasure: numero(item.minMeasure, 0),
      position: indice
    }));

/**
 * Grava a lista de itens de um negócio de uma vez só.
 *
 * A tela edita a lista inteira -- adiciona uma linha, muda a quantidade de
 * outra, apaga uma terceira -- e mandar isso como três chamadas separadas
 * deixaria o pedido inconsistente se a conexão caísse no meio. Aqui a lista
 * chega completa e substitui a anterior, o que também resolve a ordem das
 * linhas sem um endpoint só para reordenar.
 *
 * O valor do negócio é recalculado ao final: a partir do momento em que existem
 * itens, o total do card do Kanban passa a ser a soma deles, e não mais um
 * número digitado que ninguém sabe de onde veio.
 */
const SyncDealItemsService = async ({
  dealId,
  companyId,
  items
}: Request): Promise<{ deal: Deal; items: DealItem[] }> => {
  const deal = await Deal.findOne({ where: { id: dealId, companyId } });
  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  if (!Array.isArray(items)) throw new AppError("ERR_INVALID_ITEMS");

  // Orçamento que já virou pedido não muda mais: o que foi aprovado está
  // congelado no pedido, e mexer aqui faria orçamento e pedido divergirem.
  const pedido = await pedidoAtivoDo(deal, companyId);
  if (pedido) {
    throw new AppError("ERR_ORCAMENTO_TRAVADO_POR_PEDIDO", 409, {
      orderId: pedido.id,
      number: pedido.number
    });
  }

  const limpos = limparItens(items).map(item => ({
    ...item,
    dealId: deal.id,
    companyId
  }));

  const idsMantidos = limpos.map(i => i.id).filter(Boolean) as number[];

  // Apaga o que sumiu da lista antes de gravar o resto: fazer o inverso deixaria
  // duplicatas visíveis por um instante para quem estivesse com a tela aberta.
  await DealItem.destroy({
    where: {
      dealId: deal.id,
      companyId,
      ...(idsMantidos.length ? { id: { [Op.notIn]: idsMantidos } } : {})
    }
  });

  for (const item of limpos) {
    if (item.id) {
      // O companyId entra na condição para que um id de outra empresa não possa
      // ser sequestrado para dentro deste negócio.
      await DealItem.update(item, { where: { id: item.id, dealId: deal.id, companyId } });
    } else {
      await DealItem.create(item);
    }
  }

  const salvos = await DealItem.findAll({
    where: { dealId: deal.id, companyId },
    order: [["position", "ASC"], ["id", "ASC"]]
  });

  const total = salvos.reduce((soma, item) => soma + item.total, 0);
  await deal.update({ value: Number(total.toFixed(2)) });

  return { deal, items: salvos };
};

export default SyncDealItemsService;
