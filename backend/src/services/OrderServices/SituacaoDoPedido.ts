import valorLiquidoDoNegocio from "../../helpers/ValorLiquidoDoNegocio";
import Order from "../../models/Order";
import Receivable from "../../models/Receivable";
import { valorRecebidoDoPedido } from "./ItensDoPedidoService";

/** Soma das parcelas ativas (não canceladas) lançadas para o pedido. */
export const faturadoDoPedido = async (orderId: number, companyId: number): Promise<number> => {
  const soma = await Receivable.sum("amount", {
    where: { orderId, companyId, canceledAt: null }
  });
  return Number(soma || 0);
};

/** Quanto do pedido ainda não virou cobrança. */
export const restanteACobrar = async (pedido: Order, companyId: number): Promise<number> => {
  const faturado = await faturadoDoPedido(pedido.id, companyId);
  return Number((valorLiquidoDoNegocio(pedido) - faturado).toFixed(2));
};

export type SituacaoFinanceira = "cancelado" | "a_cobrar" | "cobrado" | "parcial" | "pago";

/**
 * Onde o pedido está no financeiro, calculado das parcelas -- nunca gravado,
 * para não divergir de quem dá baixa.
 */
export const situacaoFinanceira = async (
  pedido: Order,
  companyId: number
): Promise<{ situacao: SituacaoFinanceira; total: number; faturado: number; recebido: number }> => {
  const total = valorLiquidoDoNegocio(pedido);
  const [faturado, recebido] = await Promise.all([
    faturadoDoPedido(pedido.id, companyId),
    valorRecebidoDoPedido(pedido.id, companyId)
  ]);

  let situacao: SituacaoFinanceira;
  if (pedido.canceledAt) situacao = "cancelado";
  else if (recebido + 0.005 >= total && total > 0) situacao = "pago";
  else if (recebido > 0.005) situacao = "parcial";
  else if (faturado > 0.005) situacao = "cobrado";
  else situacao = "a_cobrar";

  return {
    situacao,
    total,
    faturado: Number(faturado.toFixed(2)),
    recebido: Number(recebido.toFixed(2))
  };
};
