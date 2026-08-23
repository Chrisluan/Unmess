import { Op, WhereOptions, literal } from "sequelize";

import AppError from "../../errors/AppError";
import sequelize from "../../database";
import Payable from "../../models/Payable";
import Supplier from "../../models/Supplier";
import FinancialAccount from "../../models/FinancialAccount";
import FinancialCategory from "../../models/FinancialCategory";
import FinancialEntry from "../../models/FinancialEntry";

/**
 * Contas a pagar.
 *
 * Espelha o que existe do lado de receber: a situação é deduzida das baixas, o
 * cancelamento é explícito, e o pagamento é um lançamento em
 * `FinancialEntries` -- o mesmo do recebimento, com a direção invertida.
 */

const PAGO = `COALESCE((SELECT SUM(fe.amount) FROM FinancialEntries fe
                         WHERE fe.payableId = Payable.id), 0)`;

const NAO_CANCELADA = "Payable.canceledAt IS NULL";

const CONDICAO_POR_SITUACAO: Record<string, string | null> = {
  all: null,
  canceled: "Payable.canceledAt IS NOT NULL",
  paid: `${NAO_CANCELADA} AND ${PAGO} >= Payable.amount - 0.005`,
  open: `${NAO_CANCELADA} AND ${PAGO} = 0`,
  partial: `${NAO_CANCELADA} AND ${PAGO} > 0 AND ${PAGO} < Payable.amount - 0.005`,
  overdue: `${NAO_CANCELADA} AND ${PAGO} < Payable.amount - 0.005 AND Payable.dueDate < CURDATE()`
};

export interface FiltrosPagar {
  companyId: number;
  situacao?: string;
  vencimentoDe?: string;
  vencimentoAte?: string;
  supplierId?: number | string;
  searchParam?: string;
  pagina?: number;
  porPagina?: number;
}

export const listarPagar = async ({
  companyId,
  situacao = "all",
  vencimentoDe,
  vencimentoAte,
  supplierId,
  searchParam,
  pagina = 1,
  porPagina = 50
}: FiltrosPagar) => {
  const where: WhereOptions & Record<string, any> = { companyId };

  if (supplierId) where.supplierId = supplierId;

  if (vencimentoDe || vencimentoAte) {
    where.dueDate = {
      ...(vencimentoDe ? { [Op.gte]: vencimentoDe } : {}),
      ...(vencimentoAte ? { [Op.lte]: vencimentoAte } : {})
    };
  }

  const termo = searchParam?.trim();
  if (termo) where.description = { [Op.like]: `%${termo}%` };

  const condicao = CONDICAO_POR_SITUACAO[situacao];
  if (condicao) where[Op.and as any] = literal(condicao);

  const { count, rows } = await Payable.findAndCountAll({
    where,
    attributes: { include: [[literal(PAGO), "paidAmount"]] },
    include: [
      {
        model: Supplier,
        as: "supplier",
        attributes: ["id", "name", "document"],
        required: false
      },
      {
        model: FinancialCategory,
        as: "category",
        attributes: ["id", "name"],
        required: false
      },
      {
        model: FinancialEntry,
        as: "entries",
        attributes: ["id", "amount", "occurredAt", "method", "accountId"],
        required: false,
        separate: true,
        order: [["occurredAt", "ASC"]]
      }
    ],
    order: [
      ["dueDate", "ASC"],
      ["id", "ASC"]
    ],
    limit: porPagina,
    offset: (pagina - 1) * porPagina,
    distinct: true,
    subQuery: false
  });

  const [totais] = (await Payable.findAll({
    where,
    attributes: [
      [
        literal(
          `COALESCE(SUM(CASE WHEN ${NAO_CANCELADA} THEN Payable.amount ELSE 0 END), 0)`
        ),
        "total"
      ],
      [
        literal(
          `COALESCE(SUM(CASE WHEN ${NAO_CANCELADA} THEN ${PAGO} ELSE 0 END), 0)`
        ),
        "pago"
      ],
      [
        literal(
          `COALESCE(SUM(CASE WHEN ${NAO_CANCELADA} AND Payable.dueDate < CURDATE()
                             THEN Payable.amount - ${PAGO} ELSE 0 END), 0)`
        ),
        "vencido"
      ]
    ],
    raw: true
  })) as unknown as Array<Record<string, unknown>>;

  const numero = (v: unknown) => Number(v || 0);

  return {
    payables: rows,
    count,
    hasMore: count > pagina * porPagina,
    totais: {
      total: numero(totais?.total),
      pago: numero(totais?.pago),
      aberto: numero(totais?.total) - numero(totais?.pago),
      vencido: numero(totais?.vencido)
    }
  };
};

interface ContaData {
  companyId: number;
  description: string;
  dueDate: string;
  amount: number;
  supplierId?: number | null;
  categoryId?: number | null;
  document?: string;
  notes?: string;
  /**
   * Repetir por N meses.
   *
   * É como despesa fixa entra: aluguel, internet, contador. Gera as linhas de
   * uma vez, em vez de um motor de recorrência que teria de rodar todo dia e
   * decidir o que fazer quando ninguém ligou o servidor no dia 1º.
   */
  repetirMeses?: number;
}

/** Soma meses preservando o dia; dia 31 em mês curto cai no último dia. */
const somarMeses = (iso: string, meses: number): string => {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)
  ).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
};

export const criarPagar = async (dados: ContaData): Promise<Payable[]> => {
  if (!dados.description?.trim()) throw new AppError("ERR_DESCRIPTION_REQUIRED", 400);
  if (!dados.dueDate) throw new AppError("ERR_DUE_DATE_REQUIRED", 400);
  if (!(Number(dados.amount) > 0)) throw new AppError("ERR_INVALID_AMOUNT", 400);

  const repeticoes = Math.max(1, Math.min(Number(dados.repetirMeses) || 1, 60));

  return sequelize.transaction(async transaction => {
    const criadas: Payable[] = [];

    for (let i = 0; i < repeticoes; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const criada = await Payable.create(
        {
          description: dados.description.trim(),
          installment: i + 1,
          installments: repeticoes,
          dueDate: somarMeses(dados.dueDate, i),
          amount: Number(dados.amount),
          document: dados.document || null,
          notes: dados.notes || null,
          supplierId: dados.supplierId || null,
          categoryId: dados.categoryId || null,
          companyId: dados.companyId
        },
        { transaction }
      );

      criadas.push(criada);
    }

    return criadas;
  });
};

interface PagamentoData {
  payableId: number | string;
  companyId: number;
  accountId: number | string;
  amount?: number;
  occurredAt?: string;
  method?: string;
  description?: string;
  userId?: number;
}

/**
 * Dá baixa numa conta a pagar.
 *
 * Mesmas regras da baixa de recebimento: sem valor informado, paga o que
 * falta; recusa pagar mais do que resta. Pagamento a maior não é uma conta
 * grande demais, é crédito com o fornecedor -- coisa que este módulo ainda não
 * modela, e que entraria aqui como saldo que o caixa não sabe explicar.
 */
export const pagar = async ({
  payableId,
  companyId,
  accountId,
  amount,
  occurredAt,
  method = "transfer",
  description,
  userId
}: PagamentoData): Promise<FinancialEntry> => {
  const payable = await Payable.findOne({
    where: { id: payableId, companyId },
    include: [{ model: FinancialEntry, as: "entries", required: false }]
  });

  if (!payable) throw new AppError("ERR_NO_PAYABLE_FOUND", 404);
  if (payable.canceledAt) throw new AppError("ERR_PAYABLE_CANCELED", 409);

  const conta = await FinancialAccount.findOne({
    where: { id: accountId, companyId }
  });

  if (!conta) throw new AppError("ERR_NO_ACCOUNT_FOUND", 404);

  const restante = Number((payable.amount - payable.paidAmount).toFixed(2));

  if (restante <= 0) throw new AppError("ERR_PAYABLE_ALREADY_PAID", 409);

  const valor = amount === undefined || amount === null ? restante : Number(amount);

  if (!(valor > 0)) throw new AppError("ERR_INVALID_AMOUNT", 400);
  if (valor > restante + 0.005) throw new AppError("ERR_AMOUNT_EXCEEDS_BALANCE", 400);

  return FinancialEntry.create({
    direction: "out",
    amount: valor,
    occurredAt: occurredAt || new Date().toISOString().slice(0, 10),
    method,
    description: description || payable.description,
    accountId: conta.id,
    payableId: payable.id,
    categoryId: payable.categoryId || null,
    userId: userId || null,
    companyId
  });
};

export const cancelarPagar = async (
  payableId: number | string,
  companyId: number,
  reason?: string
): Promise<Payable> => {
  const payable = await Payable.findOne({ where: { id: payableId, companyId } });

  if (!payable) throw new AppError("ERR_NO_PAYABLE_FOUND", 404);

  const baixas = await FinancialEntry.count({
    where: { payableId: payable.id, companyId }
  });

  if (baixas > 0) throw new AppError("ERR_PAYABLE_HAS_ENTRIES", 409);

  await payable.update({
    canceledAt: new Date(),
    canceledReason: reason || null
  });

  return payable;
};

// ── Fornecedores ──────────────────────────────────────────────────────────

export const listarFornecedores = async (
  companyId: number
): Promise<Supplier[]> =>
  Supplier.findAll({ where: { companyId }, order: [["name", "ASC"]] });

interface FornecedorData {
  id?: number;
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  notes?: string;
  active?: boolean;
}

export const salvarFornecedor = async (
  companyId: number,
  dados: FornecedorData
): Promise<Supplier> => {
  if (!dados.name?.trim()) throw new AppError("ERR_NAME_REQUIRED", 400);

  const valores = {
    name: dados.name.trim(),
    document: dados.document || null,
    phone: dados.phone || null,
    email: dados.email || null,
    notes: dados.notes || null,
    active: dados.active !== false,
    companyId
  };

  if (dados.id) {
    const atual = await Supplier.findOne({ where: { id: dados.id, companyId } });
    if (!atual) throw new AppError("ERR_NO_SUPPLIER_FOUND", 404);
    return atual.update(valores);
  }

  return Supplier.create(valores);
};

export const removerFornecedor = async (
  companyId: number,
  id: number | string
): Promise<void> => {
  const atual = await Supplier.findOne({ where: { id, companyId } });
  if (!atual) throw new AppError("ERR_NO_SUPPLIER_FOUND", 404);

  // Com contas lançadas, desativa: excluir deixaria o histórico de gastos sem
  // dizer para quem o dinheiro foi.
  const emUso = await Payable.count({ where: { supplierId: atual.id } });

  if (emUso > 0) {
    await atual.update({ active: false });
    return;
  }

  await atual.destroy();
};
