import AppError from "../../errors/AppError";
import Receivable from "../../models/Receivable";
import FinancialAccount from "../../models/FinancialAccount";
import FinancialEntry from "../../models/FinancialEntry";

interface Request {
  receivableId: number | string;
  companyId: number;
  accountId: number | string;
  /** Sem valor, baixa o que falta — o caso de longe mais comum. */
  amount?: number;
  occurredAt?: string;
  method?: string;
  description?: string;
  userId?: number;
}

/**
 * Dá baixa numa parcela.
 *
 * O valor é opcional de propósito: quase toda baixa é do saldo restante, e
 * obrigar a digitar um número que o sistema já sabe só cria oportunidade de
 * errar. Informado, permite o recebimento parcial -- que é a razão de a baixa
 * ser um lançamento e não um campo "pago: sim".
 *
 * Recusa receber mais do que falta. Um pagamento a maior não é um recebimento
 * grande demais: é um crédito do cliente, coisa que este módulo ainda não
 * modela, e deixar entrar aqui produziria uma parcela "quitada" com valor que
 * o fluxo de caixa não sabe explicar.
 */
const RegistrarRecebimentoService = async ({
  receivableId,
  companyId,
  accountId,
  amount,
  occurredAt,
  method = "cash",
  description,
  userId
}: Request): Promise<FinancialEntry> => {
  const receivable = await Receivable.findOne({
    where: { id: receivableId, companyId },
    include: [{ model: FinancialEntry, as: "entries", required: false }]
  });

  if (!receivable) throw new AppError("ERR_NO_RECEIVABLE_FOUND", 404);
  if (receivable.canceledAt) throw new AppError("ERR_RECEIVABLE_CANCELED", 409);

  const conta = await FinancialAccount.findOne({
    where: { id: accountId, companyId }
  });

  if (!conta) throw new AppError("ERR_NO_ACCOUNT_FOUND", 404);

  const restante = Number((receivable.amount - receivable.paidAmount).toFixed(2));

  if (restante <= 0) throw new AppError("ERR_RECEIVABLE_ALREADY_PAID", 409);

  const valor = amount === undefined || amount === null ? restante : Number(amount);

  if (!(valor > 0)) throw new AppError("ERR_INVALID_AMOUNT", 400);

  // Meio centavo de folga: o arredondamento das parcelas não pode impedir a
  // última baixa de fechar a conta.
  if (valor > restante + 0.005) {
    throw new AppError("ERR_AMOUNT_EXCEEDS_BALANCE", 400);
  }

  return FinancialEntry.create({
    direction: "in",
    amount: valor,
    occurredAt: occurredAt || new Date().toISOString().slice(0, 10),
    method,
    description: description || receivable.description,
    accountId: conta.id,
    receivableId: receivable.id,
    categoryId: receivable.categoryId || null,
    userId: userId || null,
    companyId
  });
};

export default RegistrarRecebimentoService;
