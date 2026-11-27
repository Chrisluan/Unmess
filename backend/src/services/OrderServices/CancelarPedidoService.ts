import { Op } from "sequelize";

import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import DealActivity from "../../models/DealActivity";
import Order from "../../models/Order";
import Receivable from "../../models/Receivable";
import { valorRecebidoDoPedido } from "./ItensDoPedidoService";

interface Request {
  orderId: number | string;
  companyId: number;
  userId?: number;
  motivo?: string;
}

/**
 * Cancela um pedido.
 *
 * Desfaz o que o pedido criou: as parcelas em aberto são canceladas, os cards
 * de produção saem do fluxo (como perdidos, com o motivo) e o orçamento de
 * origem volta a poder ser editado -- para corrigir e gerar um pedido novo.
 *
 * Com dinheiro já recebido, não: devolver valor é uma decisão financeira, e
 * cancelar por aqui deixaria um recebimento órfão.
 */
const CancelarPedidoService = async ({
  orderId,
  companyId,
  userId,
  motivo
}: Request): Promise<Order> => {
  const pedido = await Order.findOne({ where: { id: orderId, companyId } });
  if (!pedido) throw new AppError("ERR_PEDIDO_NAO_ENCONTRADO", 404);
  if (pedido.canceledAt) throw new AppError("ERR_PEDIDO_CANCELADO", 409);

  const recebido = await valorRecebidoDoPedido(pedido.id, companyId);
  if (recebido > 0.005) {
    throw new AppError("ERR_PEDIDO_COM_RECEBIMENTO", 409, {
      recebido: Number(recebido.toFixed(2))
    });
  }

  const razao = (motivo || "").trim().slice(0, 250) || null;
  const agora = new Date();

  await sequelize.transaction(async transaction => {
    await Receivable.update(
      { canceledAt: agora, canceledReason: `Pedido nº ${pedido.number} cancelado` },
      { where: { orderId: pedido.id, companyId, canceledAt: null }, transaction }
    );

    await pedido.update(
      { canceledAt: agora, canceledReason: razao, status: "canceled" },
      { transaction }
    );

    // Cards de produção ainda em andamento saem do fluxo. Os já concluídos
    // ficam como estão: são histórico do que foi feito.
    await Deal.update(
      {
        status: "lost",
        closedAt: agora,
        lostReason: `Pedido nº ${pedido.number} cancelado${razao ? `: ${razao}` : ""}`
      },
      {
        where: {
          orderId: pedido.id,
          companyId,
          id: { [Op.ne]: pedido.dealId || 0 },
          status: "open"
        },
        transaction
      }
    );

    if (pedido.dealId) {
      await DealActivity.create(
        {
          type: "order_canceled",
          body: `Pedido nº ${pedido.number} cancelado${razao ? `: ${razao}` : ""}`,
          dealId: pedido.dealId,
          userId: userId || null,
          companyId
        },
        { transaction }
      );
    }
  });

  return pedido;
};

export default CancelarPedidoService;
