import { Op, WhereOptions, literal } from "sequelize";

import Deal from "../../models/Deal";
import Customer from "../../models/Customer";
import Contact from "../../models/Contact";
import Order from "../../models/Order";
import PaymentTerm from "../../models/PaymentTerm";
import valorLiquidoDoNegocio from "../../helpers/ValorLiquidoDoNegocio";

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
    /**
     * "Sem cobrança" é a ausência de linha em Receivables. NOT EXISTS em vez
     * de LEFT JOIN com IS NULL: o banco para na primeira parcela encontrada,
     * em vez de montar o par para depois descartar.
     */
    [Op.and as any]: literal(
      `NOT EXISTS (SELECT 1 FROM Receivables r WHERE r.dealId = Deal.id)`
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
  return deals.map(deal => ({
    id: deal.id,
    title: deal.title,
    wonAt: deal.wonAt,
    valorBruto: Number(deal.value || 0),
    total: valorLiquidoDoNegocio(deal),
    customer: deal.customer,
    contact: deal.contact,
    salesOrder: deal.salesOrder,
    paymentTerm: deal.paymentTerm
  }));
};

export default ListarPendentesDeCobrancaService;
