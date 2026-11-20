import { Op } from "sequelize";

import sequelize from "../../database";
import AppError from "../../errors/AppError";
import valorLiquidoDoNegocio from "../../helpers/ValorLiquidoDoNegocio";
import Deal from "../../models/Deal";
import FinancialEntry from "../../models/FinancialEntry";
import Order from "../../models/Order";
import OrderItem from "../../models/OrderItem";
import Receivable from "../../models/Receivable";
import { ItemEntrada, limparItens } from "../DealItemServices/SyncDealItemsService";

export const listarItensDoPedido = async (
  orderId: number,
  companyId: number
): Promise<OrderItem[]> =>
  OrderItem.findAll({
    where: { orderId, companyId },
    order: [["position", "ASC"], ["id", "ASC"]]
  });

/** Quanto do pedido já entrou de fato no caixa, somando as parcelas ativas. */
export const valorRecebidoDoPedido = async (
  orderId: number,
  companyId: number
): Promise<number> => {
  const parcelas = await Receivable.findAll({
    where: { orderId, companyId, canceledAt: null },
    include: [{ model: FinancialEntry, as: "entries", attributes: ["amount", "direction"] }]
  });
  return parcelas.reduce((soma, parcela) => soma + parcela.paidAmount, 0);
};

interface Request {
  order: Order;
  companyId: number;
  items: ItemEntrada[];
}

/**
 * Altera os itens de um pedido já gerado.
 *
 * É mexer no que o cliente aprovou, e por isso tem permissão própria
 * (crm:editOrder) e uma trava: o pedido não pode ficar valendo menos do que já
 * foi recebido -- isso viraria um crédito do cliente que ninguém registrou.
 *
 * Os cards de produção não guardam itens, então a mudança aparece em todos
 * eles; só o valor exibido no card é atualizado aqui.
 */
export const alterarItensDoPedido = async ({
  order,
  companyId,
  items
}: Request): Promise<{ order: Order; items: OrderItem[] }> => {
  if (order.canceledAt) throw new AppError("ERR_PEDIDO_CANCELADO", 409);
  if (!Array.isArray(items)) throw new AppError("ERR_INVALID_ITEMS");

  const limpos = limparItens(items);
  if (limpos.length === 0) throw new AppError("ERR_PEDIDO_SEM_ITENS", 400);

  // Mesma conta do item gravado: monta instâncias sem salvar só para somar.
  const bruto = limpos.reduce(
    (soma, item) => soma + OrderItem.build(item as Partial<OrderItem>).total,
    0
  );
  const liquido = valorLiquidoDoNegocio({
    value: bruto,
    discount: order.discount,
    discountType: order.discountType
  });

  const recebido = await valorRecebidoDoPedido(order.id, companyId);
  if (liquido + 0.005 < recebido) {
    throw new AppError("ERR_PEDIDO_ABAIXO_DO_RECEBIDO", 409, {
      recebido: Number(recebido.toFixed(2)),
      novoTotal: liquido
    });
  }

  await sequelize.transaction(async transaction => {
    const idsMantidos = limpos.map(i => i.id).filter(Boolean) as number[];

    await OrderItem.destroy({
      where: {
        orderId: order.id,
        companyId,
        ...(idsMantidos.length ? { id: { [Op.notIn]: idsMantidos } } : {})
      },
      transaction
    });

    // eslint-disable-next-line no-restricted-syntax
    for (const item of limpos) {
      const dados = { ...item, orderId: order.id, companyId };
      if (item.id) {
        // eslint-disable-next-line no-await-in-loop
        await OrderItem.update(dados, {
          where: { id: item.id, orderId: order.id, companyId },
          transaction
        });
      } else {
        // eslint-disable-next-line no-await-in-loop
        await OrderItem.create({ ...dados, id: undefined }, { transaction });
      }
    }

    const valor = Number(bruto.toFixed(2));
    await order.update({ value: valor }, { transaction });

    // O valor do card de produção acompanha o pedido. O orçamento de origem,
    // não: ele registra o que foi orçado.
    await Deal.update(
      { value: valor },
      {
        where: { orderId: order.id, companyId, id: { [Op.ne]: order.dealId || 0 } },
        transaction
      }
    );
  });

  return { order, items: await listarItensDoPedido(order.id, companyId) };
};
