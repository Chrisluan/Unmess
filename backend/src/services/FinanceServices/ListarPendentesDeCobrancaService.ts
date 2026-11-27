import { Op, WhereOptions, literal } from "sequelize";

import Deal from "../../models/Deal";
import Customer from "../../models/Customer";
import Contact from "../../models/Contact";
import Order from "../../models/Order";
import PaymentTerm from "../../models/PaymentTerm";
import valorLiquidoDoNegocio from "../../helpers/ValorLiquidoDoNegocio";
import { restanteACobrar } from "../OrderServices/SituacaoDoPedido";

interface Request {
  companyId: number;
}

/**
 * Vendas faturadas que ainda não viraram cobrança.
 *
 * É a fila que sustenta a geração "automática com confirmação": o card cruza a
 * coluna de ganho e aparece aqui, esperando alguém conferir as parcelas.
 *
 * A fila existe em vez de um aviso na hora do arrasto porque aviso se fecha.
 * Quem move o card no fim do expediente não é necessariamente quem cuida do
 * financeiro, e uma janela dispensada sem querer sumiria com a cobrança sem
 * deixar rastro. Aqui a venda fica visível até alguém resolver.
 */
const ListarPendentesDeCobrancaService = async ({ companyId }: Request) => {
  const where: WhereOptions & Record<string, any> = {
    companyId,
    wonAt: { [Op.not]: null } as any,
    // Cancelamento da venda não vira cobrança pendente.
    status: { [Op.ne]: "lost" },
    // Card com pedido é cobrado pelo pedido (abaixo), não por si.
    orderId: null,
    /**
     * "Sem cobrança" é a ausência de linha em Receivables. NOT EXISTS em vez
     * de LEFT JOIN com IS NULL: o banco para na primeira parcela encontrada,
     * em vez de montar o par para depois descartar.
     */
    [Op.and as any]: literal(
      `NOT EXISTS (SELECT 1 FROM Receivables r WHERE r.dealId = Deal.id AND r.canceledAt IS NULL)`
    )
  };

  const deals = await Deal.findAll({
    where,
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: ["id", "name", "tradeName"],
        required: false
      },
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number"],
        required: false
      },
      {
        model: Order,
        as: "salesOrder",
        attributes: ["id", "number", "quoteNumber"],
        required: false
      },
      {
        model: PaymentTerm,
        as: "paymentTerm",
        attributes: ["id", "name", "dayOffsets", "percentages"],
        required: false
      }
    ],
    order: [["wonAt", "ASC"]]
  });

  // O total já sai calculado: a tela lista dezenas destes e refazer a conta do
  // desconto em JavaScript, item por item, é justamente o que o helper evita.
  const semPedido = deals.map(deal => ({
    id: deal.id,
    orderId: null as number | null,
    title: deal.title,
    wonAt: deal.wonAt,
    valorBruto: Number(deal.value || 0),
    total: valorLiquidoDoNegocio(deal),
    customer: deal.customer,
    contact: deal.contact,
    salesOrder: deal.salesOrder,
    paymentTerm: deal.paymentTerm
  }));

  /**
   * Pedidos com valor ainda não coberto por parcelas ativas.
   *
   * O pedido é a venda aprovada: entra na fila assim que é gerado, sem
   * esperar o card percorrer a produção. O `id` devolvido é o do orçamento
   * de origem, que é o que a tela usa para propor e gerar a cobrança.
   */
  const pedidos = await Order.findAll({
    where: { companyId, canceledAt: null },
    include: [
      { model: Customer, as: "customer", attributes: ["id", "name", "tradeName"], required: false },
      { model: Contact, as: "contact", attributes: ["id", "name", "number"], required: false },
      {
        model: PaymentTerm,
        as: "paymentTerm",
        attributes: ["id", "name", "dayOffsets", "percentages"],
        required: false
      }
    ],
    order: [["approvedAt", "ASC"]]
  });

  const comPedido = (
    await Promise.all(
      pedidos.map(async pedido => {
        const restante = await restanteACobrar(pedido, companyId);
        if (restante <= 0.005) return null;
        return {
          id: pedido.dealId,
          orderId: pedido.id,
          title: pedido.title,
          wonAt: pedido.approvedAt || pedido.createdAt,
          valorBruto: pedido.value,
          total: restante,
          customer: pedido.customer,
          contact: pedido.contact,
          salesOrder: { id: pedido.id, number: pedido.number, quoteNumber: pedido.quoteNumber },
          paymentTerm: pedido.paymentTerm
        };
      })
    )
  ).filter(Boolean);

  return [...comPedido, ...semPedido];
};

export default ListarPendentesDeCobrancaService;
