import AppError from "../../errors/AppError";
import PaymentTerm from "../../models/PaymentTerm";
import FinancialAccount from "../../models/FinancialAccount";
import FinancialCategory from "../../models/FinancialCategory";
import Receivable from "../../models/Receivable";
import FinancialEntry from "../../models/FinancialEntry";

/**
 * Os três cadastros de apoio do financeiro: condições de pagamento, contas e
 * categorias.
 *
 * Num arquivo só, e não em doze. O padrão da casa é um serviço por operação,
 * que existe para dar lugar à regra de negócio -- e aqui não há nenhuma além
 * de "pertence a esta empresa" e "não apaga o que está em uso". Espalhar isso
 * por doze arquivos de dez linhas esconderia justamente o que eles têm em
 * comum.
 */

/** Toda leitura é da empresa. É o que impede um tenant ver o do outro. */
const daEmpresa = (companyId: number) => ({ where: { companyId } });

// ── Condições de pagamento ────────────────────────────────────────────────

export const listarCondicoes = async (companyId: number): Promise<PaymentTerm[]> =>
  PaymentTerm.findAll({ ...daEmpresa(companyId), order: [["name", "ASC"]] });

interface CondicaoData {
  id?: number;
  name: string;
  dayOffsets: number[];
  percentages?: number[] | null;
  active?: boolean;
}

export const salvarCondicao = async (
  companyId: number,
  dados: CondicaoData
): Promise<PaymentTerm> => {
  const prazos = (dados.dayOffsets || [])
    .map(Number)
    .filter(n => Number.isFinite(n) && n >= 0);

  if (!prazos.length) throw new AppError("ERR_PAYMENT_TERM_NEEDS_OFFSETS", 400);

  /**
   * Percentuais só valem se houver um para cada parcela e somarem 100. Uma
   * lista pela metade cobraria menos que o pedido, em silêncio.
   */
  const percentuais = dados.percentages?.length ? dados.percentages.map(Number) : null;

  if (percentuais) {
    if (percentuais.length !== prazos.length) {
      throw new AppError("ERR_PAYMENT_TERM_PERCENT_COUNT", 400);
    }
    const soma = percentuais.reduce((s, p) => s + p, 0);
    if (Math.abs(soma - 100) > 0.01) {
      throw new AppError("ERR_PAYMENT_TERM_PERCENT_SUM", 400);
    }
  }

  const valores = {
    name: dados.name,
    dayOffsets: prazos,
    percentages: percentuais,
    active: dados.active !== false,
    companyId
  };

  if (dados.id) {
    const atual = await PaymentTerm.findOne({ where: { id: dados.id, companyId } });
    if (!atual) throw new AppError("ERR_NO_PAYMENT_TERM_FOUND", 404);
    return atual.update(valores);
  }

  return PaymentTerm.create(valores);
};

export const removerCondicao = async (
  companyId: number,
  id: number | string
): Promise<void> => {
  const atual = await PaymentTerm.findOne({ where: { id, companyId } });
  if (!atual) throw new AppError("ERR_NO_PAYMENT_TERM_FOUND", 404);

  // Em uso, desativa. Excluir deixaria as cobranças antigas apontando para o
  // nada, e ninguém saberia mais em quantas vezes aquele pedido foi vendido.
  const emUso = await Receivable.count({ where: { paymentTermId: atual.id } });

  if (emUso > 0) {
    await atual.update({ active: false });
    return;
  }

  await atual.destroy();
};

// ── Contas (caixa, banco, cartão) ─────────────────────────────────────────

export const listarContas = async (companyId: number): Promise<FinancialAccount[]> =>
  FinancialAccount.findAll({ ...daEmpresa(companyId), order: [["name", "ASC"]] });

interface ContaData {
  id?: number;
  name: string;
  kind?: string;
  openingBalance?: number;
  active?: boolean;
}

export const salvarConta = async (
  companyId: number,
  dados: ContaData
): Promise<FinancialAccount> => {
  const valores = {
    name: dados.name,
    kind: dados.kind || "cash",
    openingBalance: Number(dados.openingBalance) || 0,
    active: dados.active !== false,
    companyId
  };

  if (dados.id) {
    const atual = await FinancialAccount.findOne({
      where: { id: dados.id, companyId }
    });
    if (!atual) throw new AppError("ERR_NO_ACCOUNT_FOUND", 404);
    return atual.update(valores);
  }

  return FinancialAccount.create(valores);
};

export const removerConta = async (
  companyId: number,
  id: number | string
): Promise<void> => {
  const atual = await FinancialAccount.findOne({ where: { id, companyId } });
  if (!atual) throw new AppError("ERR_NO_ACCOUNT_FOUND", 404);

  // Conta com movimento não se apaga: o saldo histórico deixaria de fechar.
  const movimento = await FinancialEntry.count({ where: { accountId: atual.id } });

  if (movimento > 0) {
    await atual.update({ active: false });
    return;
  }

  await atual.destroy();
};

// ── Categorias ────────────────────────────────────────────────────────────

export const listarCategorias = async (
  companyId: number
): Promise<FinancialCategory[]> =>
  FinancialCategory.findAll({
    ...daEmpresa(companyId),
    order: [["kind", "ASC"], ["name", "ASC"]]
  });

interface CategoriaData {
  id?: number;
  name: string;
  kind: string;
  active?: boolean;
}

export const salvarCategoria = async (
  companyId: number,
  dados: CategoriaData
): Promise<FinancialCategory> => {
  if (!["income", "expense"].includes(dados.kind)) {
    throw new AppError("ERR_INVALID_CATEGORY_KIND", 400);
  }

  const valores = {
    name: dados.name,
    kind: dados.kind,
    active: dados.active !== false,
    companyId
  };

  if (dados.id) {
    const atual = await FinancialCategory.findOne({
      where: { id: dados.id, companyId }
    });
    if (!atual) throw new AppError("ERR_NO_CATEGORY_FOUND", 404);
    return atual.update(valores);
  }

  return FinancialCategory.create(valores);
};

export const removerCategoria = async (
  companyId: number,
  id: number | string
): Promise<void> => {
  const atual = await FinancialCategory.findOne({ where: { id, companyId } });
  if (!atual) throw new AppError("ERR_NO_CATEGORY_FOUND", 404);

  const emUso =
    (await Receivable.count({ where: { categoryId: atual.id } })) +
    (await FinancialEntry.count({ where: { categoryId: atual.id } }));

  if (emUso > 0) {
    await atual.update({ active: false });
    return;
  }

  await atual.destroy();
};
