import AppError from "../../errors/AppError";
import Receivable from "../../models/Receivable";
import FinancialEntry from "../../models/FinancialEntry";

interface Request {
  receivableId: number | string;
  companyId: number;
  reason?: string;
}

/**
 * Cancela uma parcela.
 *
 * Cancelar não apaga: a cobrança existiu, o cliente pode ter sido avisado dela,
 * e sumir com a linha deixaria a numeração das parcelas com um buraco que
 * ninguém sabe explicar. Ela fica, marcada, fora de toda soma.
 *
 * Parcela com baixa não é cancelada. Já entrou dinheiro contra ela, e cancelar
 * deixaria esse dinheiro apontando para uma cobrança que "não existe" -- o
 * caminho é estornar as baixas primeiro, que é uma decisão explícita.
 */
const CancelarCobrancaService = async ({
  receivableId,
  companyId,
  reason
}: Request): Promise<Receivable> => {
  const receivable = await Receivable.findOne({
    where: { id: receivableId, companyId }
  });

  if (!receivable) throw new AppError("ERR_NO_RECEIVABLE_FOUND", 404);

  const baixas = await FinancialEntry.count({
    where: { receivableId: receivable.id, companyId }
  });

  if (baixas > 0) throw new AppError("ERR_RECEIVABLE_HAS_ENTRIES", 409);

  await receivable.update({
    canceledAt: new Date(),
    canceledReason: reason || null
  });

  return receivable;
};

export default CancelarCobrancaService;
