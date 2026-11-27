import AppError from "../../errors/AppError";
import sequelize from "../../database";
import Deal from "../../models/Deal";
import Order from "../../models/Order";
import Receivable from "../../models/Receivable";
import { pedidoAtivoDo } from "../OrderServices/GerarPedidoService";
import { restanteACobrar } from "../OrderServices/SituacaoDoPedido";

interface ParcelaConfirmada {
  dueDate: string;
  amount: number | string;
  installment?: number;
}

interface Request {
  dealId?: number | string;
  companyId: number;
  /** As parcelas como a pessoa confirmou — podem ter sido ajustadas na tela. */
  parcelas: ParcelaConfirmada[];
  descricao?: string;
  customerId?: number | null;
  paymentTermId?: number | null;
  categoryId?: number | null;
  notes?: string;
}

/**
 * Grava a cobrança confirmada.
 *
 * Recebe as parcelas prontas em vez de recalculá-las: quem confirmou pode ter
 * mudado uma data ou um valor na tela, e refazer a conta aqui jogaria fora
 * justamente o ajuste que a confirmação existe para permitir.
 *
 * Tudo numa transação. Metade das parcelas gravadas é pior que nenhuma -- o
 * cliente ficaria devendo um pedaço do pedido, e ninguém teria como saber que
 * faltou.
 */
const GerarCobrancaService = async ({
  dealId,
  companyId,
  parcelas,
  descricao,
  customerId,
  paymentTermId,
  categoryId,
  notes
}: Request): Promise<Receivable[]> => {
  if (!parcelas?.length) throw new AppError("ERR_NO_INSTALLMENTS", 400);

  let deal: Deal | null = null;
  let orderId: number | null = null;
  let pedido: Order | null = null;

  if (dealId) {
    deal = await Deal.findOne({
      where: { id: dealId, companyId },
      include: [{ model: Order, as: "salesOrder", required: false }]
    });

    if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

    /**
     * Card ligado a pedido: a cobrança é do pedido, venha de qual card vier
     * (orçamento ou produção). O limite é o que falta cobrar -- dá para
     * cobrar em partes, mas nunca acima do pedido. Abrir a tela duas vezes e
     * confirmar nas duas não deixa mais o cliente devendo o dobro.
     */
    pedido = await pedidoAtivoDo(deal, companyId);

    if (pedido) {
      const restante = await restanteACobrar(pedido, companyId);
      const agora = parcelas.reduce((soma, p) => soma + (Number(p.amount) || 0), 0);
      if (restante <= 0.005) throw new AppError("ERR_RECEIVABLE_ALREADY_EXISTS", 409);
      if (agora > restante + 0.01) {
        throw new AppError("ERR_COBRANCA_ACIMA_DO_PEDIDO", 409, {
          restante: Number(restante.toFixed(2))
        });
      }
      orderId = pedido.id;
    } else {
      /**
       * Card sem pedido (anterior a ele): um card, uma cobrança. Parcelas
       * canceladas não contam -- antes contavam, e um card com a cobrança
       * cancelada nunca mais podia ser cobrado.
       */
      const jaExiste = await Receivable.count({
        where: { dealId: deal.id, companyId, canceledAt: null }
      });

      if (jaExiste > 0) throw new AppError("ERR_RECEIVABLE_ALREADY_EXISTS", 409);

      orderId = deal.salesOrder?.id || null;
    }
  }

  const texto =
    descricao ||
    (pedido ? `Pedido nº ${pedido.number} — ${pedido.title || deal?.title || ""}` : null) ||
    deal?.title ||
    "Cobrança avulsa";
  const total = parcelas.length;

  return sequelize.transaction(async transaction => {
    const criadas: Receivable[] = [];

    for (let i = 0; i < parcelas.length; i += 1) {
      const parcela = parcelas[i];

      // eslint-disable-next-line no-await-in-loop
      const criada = await Receivable.create(
        {
          description: texto,
          installment: parcela.installment || i + 1,
          installments: total,
          dueDate: parcela.dueDate,
          amount: Number(parcela.amount) || 0,
          // A cobrança do pedido fica presa ao orçamento de origem: é por ele
          // que a trilha liga conversa, orçamento, pedido e cobrança.
          dealId: pedido?.dealId || deal?.id || null,
          orderId,
          customerId: customerId ?? pedido?.customerId ?? deal?.customerId ?? null,
          paymentTermId: paymentTermId ?? pedido?.paymentTermId ?? deal?.paymentTermId ?? null,
          categoryId: categoryId || null,
          notes: notes || null,
          companyId
        },
        { transaction }
      );

      criadas.push(criada);
    }

    // O pedido deixa de estar só "aberto": existe cobrança lançada para ele.
    if (orderId) {
      await Order.update(
        { status: "billed" },
        { where: { id: orderId, companyId }, transaction }
      );
    }

    return criadas;
  });
};

export default GerarCobrancaService;
