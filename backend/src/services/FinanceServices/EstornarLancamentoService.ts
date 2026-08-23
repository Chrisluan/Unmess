import AppError from "../../errors/AppError";
import FinancialEntry from "../../models/FinancialEntry";

interface Request {
  entryId: number | string;
  companyId: number;
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
  companyId
}: Request): Promise<void> => {
  const entry = await FinancialEntry.findOne({
    where: { id: entryId, companyId }
  });

  if (!entry) throw new AppError("ERR_NO_ENTRY_FOUND", 404);

  await entry.destroy();
};

export default EstornarLancamentoService;
