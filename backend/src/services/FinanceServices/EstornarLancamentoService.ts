import AppError from "../../errors/AppError";
import FinancialEntry from "../../models/FinancialEntry";
import Receivable from "../../models/Receivable";
import DealActivity from "../../models/DealActivity";

interface Request {
  entryId: number | string;
  companyId: number;
  userId?: number;
}

/**
 * Estorna um lançamento — apaga o movimento de dinheiro.
 *
 * Apagar, e não marcar como estornado: a situação da parcela é deduzida da
 * soma das baixas, então um lançamento "cancelado" que continuasse na tabela
 * teria de ser descontado em todo lugar que soma -- e bastaria esquecer um
 * para o caixa divergir do a receber.
 *
 * O rastro de quem baixou fica na timeline do negócio e no histórico do
 * registro; o que não pode sobrar é dinheiro fantasma no saldo.
 */
const EstornarLancamentoService = async ({
  entryId,
  companyId,
  userId
}: Request): Promise<void> => {
  const entry = await FinancialEntry.findOne({
    where: { id: entryId, companyId }
  });

  if (!entry) throw new AppError("ERR_NO_ENTRY_FOUND", 404);

  // O lançamento some, mas o estorno fica na linha do tempo do orçamento: sem
  // isso, dinheiro que entrou e saiu não deixava rastro nenhum.
  const parcela = entry.receivableId
    ? await Receivable.findOne({ where: { id: entry.receivableId, companyId } })
    : null;

  await entry.destroy();

  if (parcela?.dealId) {
    await DealActivity.create({
      type: "note",
      body: `Estorno de ${Number(entry.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} na parcela ${parcela.installment}/${parcela.installments} (${parcela.description})`,
      dealId: parcela.dealId,
      userId: userId || null,
      companyId
    });
  }
};

export default EstornarLancamentoService;
