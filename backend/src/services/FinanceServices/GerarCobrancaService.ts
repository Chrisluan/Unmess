import AppError from "../../errors/AppError";
import sequelize from "../../database";
import Deal from "../../models/Deal";
import Order from "../../models/Order";
import Receivable from "../../models/Receivable";

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

  if (dealId) {
    deal = await Deal.findOne({
      where: { id: dealId, companyId },
      include: [{ model: Order, as: "salesOrder", required: false }]
    });

    if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

    /**
     * Um pedido, uma cobrança.
     *
     * Sem esta trava, abrir a tela duas vezes e confirmar nas duas deixaria o
     * cliente devendo o dobro -- e o erro só apareceria na hora da conversa
     * constrangedora. Para recobrar é preciso cancelar a cobrança anterior,
     * que é uma decisão explícita e fica registrada.
     */
    const jaExiste = await Receivable.count({
      where: { dealId: deal.id, companyId }
    });

    if (jaExiste > 0) throw new AppError("ERR_RECEIVABLE_ALREADY_EXISTS", 409);

    orderId = deal.salesOrder?.id || null;
  }

  const texto = descricao || deal?.title || "Cobrança avulsa";
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
          dealId: deal?.id || null,
          orderId,
          customerId: customerId ?? deal?.customerId ?? null,
          paymentTermId: paymentTermId ?? deal?.paymentTermId ?? null,
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
