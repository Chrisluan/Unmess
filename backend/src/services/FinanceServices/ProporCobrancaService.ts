import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import Customer from "../../models/Customer";
import Order from "../../models/Order";
import Receivable from "../../models/Receivable";
import PaymentTerm from "../../models/PaymentTerm";
import calcularParcelas, {
  ParcelaCalculada
} from "../../helpers/CalcularParcelas";
import valorLiquidoDoNegocio from "../../helpers/ValorLiquidoDoNegocio";

interface Request {
  dealId: number | string;
  companyId: number;
  /** Condição escolhida na hora; sem ela, a que está gravada no negócio. */
  paymentTermId?: number | string;
}

export interface PropostaDeCobranca {
  dealId: number;
  orderId: number | null;
  customerId: number | null;
  customerName: string | null;
  descricao: string;
  /** Bruto, desconto e o que o cliente paga — os três, para a tela conferir. */
  valorBruto: number;
  desconto: number;
  total: number;
  paymentTermId: number | null;
  paymentTermName: string | null;
  parcelas: ParcelaCalculada[];
  /** Já existe cobrança para este negócio? Impede gerar duas vezes sem querer. */
  jaTemCobranca: boolean;
}

/**
 * Monta a proposta de cobrança de um pedido faturado — sem gravar nada.
 *
 * A geração é automática **com confirmação**: o sistema calcula as parcelas a
 * partir da condição de pagamento e alguém confere antes de virar dívida do
 * cliente. Gravar direto tiraria a chance de corrigir uma condição escolhida
 * errado no fechamento, e desfazer cobrança já lançada é bem mais caro do que
 * ajustar uma proposta na tela.
 *
 * A data base é o dia em que a venda foi ganha, não hoje: um pedido faturado
 * na sexta e lançado na segunda vence contado da sexta.
 */
const ProporCobrancaService = async ({
  dealId,
  companyId,
  paymentTermId
}: Request): Promise<PropostaDeCobranca> => {
  const deal = await Deal.findOne({
    where: { id: dealId, companyId },
    include: [
      { model: Customer, as: "customer", required: false },
      { model: Order, as: "salesOrder", required: false }
    ]
  });

  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  const escolhida = paymentTermId || deal.paymentTermId;

  const term = escolhida
    ? await PaymentTerm.findOne({ where: { id: escolhida, companyId } })
    : null;

  /**
   * Sem condição escolhida, a proposta é à vista.
   *
   * É o caso mais comum no balcão, e devolver uma proposta vazia obrigaria a
   * tela a inventar uma regra própria -- que divergiria desta na primeira
   * mudança.
   */
  const prazos = term ? term.dayOffsets : [0];
  const percentuais = term ? term.percentages : null;

  const total = valorLiquidoDoNegocio(deal);

  const parcelas = calcularParcelas({
    total,
    dayOffsets: prazos,
    percentages: percentuais,
    baseDate: deal.wonAt || deal.closedAt || new Date()
  });

  const jaTemCobranca =
    (await Receivable.count({ where: { dealId: deal.id, companyId } })) > 0;

  const bruto = Number(deal.value || 0);

  return {
    dealId: deal.id,
    orderId: deal.salesOrder?.id || null,
    customerId: deal.customerId || null,
    customerName: deal.customer?.name || null,
    descricao: deal.salesOrder?.number
      ? `Pedido nº ${deal.salesOrder.number} — ${deal.title}`
      : deal.title,
    valorBruto: bruto,
    desconto: Number((bruto - total).toFixed(2)),
    total,
    paymentTermId: term?.id || null,
    paymentTermName: term?.name || "À vista",
    parcelas,
    jaTemCobranca
  };
};

export default ProporCobrancaService;
