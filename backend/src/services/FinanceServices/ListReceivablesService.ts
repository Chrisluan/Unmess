import { Op, WhereOptions, literal } from "sequelize";

import Receivable from "../../models/Receivable";
import Customer from "../../models/Customer";
import FinancialEntry from "../../models/FinancialEntry";
import FinancialCategory from "../../models/FinancialCategory";

export interface FiltrosReceber {
  companyId: number;
  /** all | open | partial | paid | overdue | canceled */
  situacao?: string;
  vencimentoDe?: string;
  vencimentoAte?: string;
  customerId?: number | string;
  searchParam?: string;
  pagina?: number;
  porPagina?: number;
}

/**
 * Quanto já foi baixado numa parcela, em SQL.
 *
 * Subconsulta, e não join com GROUP BY: o join multiplicaria a linha da
 * parcela por baixa, e todo outro agregado da mesma consulta sairia errado.
 */
const PAGO = `COALESCE((SELECT SUM(fe.amount) FROM FinancialEntries fe
                         WHERE fe.receivableId = Receivable.id), 0)`;

const NAO_CANCELADA = "Receivable.canceledAt IS NULL";

/**
 * A situação é deduzida do valor contra o baixado, então o filtro precisa
 * acontecer no banco. Deduzir em JavaScript obrigaria a trazer a tabela
 * inteira para descartar quase tudo, e a paginação passaria a mentir sobre o
 * total.
 *
 * As condições entram no WHERE e não no HAVING: sem GROUP BY, o HAVING do
 * MySQL 8 sob ONLY_FULL_GROUP_BY é terreno movediço, e subconsulta no WHERE
 * é o caminho que sempre valeu.
 */
const CONDICAO_POR_SITUACAO: Record<string, string | null> = {
  all: null,
  canceled: "Receivable.canceledAt IS NOT NULL",
  paid: `${NAO_CANCELADA} AND ${PAGO} >= Receivable.amount - 0.005`,
  open: `${NAO_CANCELADA} AND ${PAGO} = 0`,
  partial: `${NAO_CANCELADA} AND ${PAGO} > 0 AND ${PAGO} < Receivable.amount - 0.005`,
  // Vencida é situação de tempo, não de valor: passou da data e não quitou.
  overdue: `${NAO_CANCELADA} AND ${PAGO} < Receivable.amount - 0.005 AND Receivable.dueDate < CURDATE()`
};

const ListReceivablesService = async ({
  companyId,
  situacao = "all",
  vencimentoDe,
  vencimentoAte,
  customerId,
  searchParam,
  pagina = 1,
  porPagina = 50
}: FiltrosReceber) => {
  const where: WhereOptions & Record<string, any> = { companyId };

  if (customerId) where.customerId = customerId;

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

  const { count, rows } = await Receivable.findAndCountAll({
    where,
    // O alias é lido pelo getter `paidAmount` do modelo, que prefere este
    // agregado a somar as baixas carregadas.
    attributes: { include: [[literal(PAGO), "paidAmount"]] },
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: ["id", "name", "tradeName", "document", "phone"],
        required: false
      },
      {
        model: FinancialCategory,
        as: "category",
        attributes: ["id", "name"],
        required: false
      },
      {
        // separate: a lista de baixas é detalhe da linha, e um join aqui
        // multiplicaria a parcela por recebimento.
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

  /**
   * Totais da seleção inteira, não da página.
   *
   * "Quanto tenho a receber" é a pergunta que esta tela existe para responder,
   * e somar a página daria o total dos cinquenta primeiros vencimentos.
   */
  const [totais] = (await Receivable.findAll({
    where,
    attributes: [
      [
        literal(
          `COALESCE(SUM(CASE WHEN ${NAO_CANCELADA} THEN Receivable.amount ELSE 0 END), 0)`
        ),
        "total"
      ],
      [
        literal(
          `COALESCE(SUM(CASE WHEN ${NAO_CANCELADA} THEN ${PAGO} ELSE 0 END), 0)`
        ),
        "recebido"
      ],
      [
        literal(
          `COALESCE(SUM(CASE WHEN ${NAO_CANCELADA} AND Receivable.dueDate < CURDATE()
                             THEN Receivable.amount - ${PAGO} ELSE 0 END), 0)`
        ),
        "vencido"
      ]
    ],
    raw: true
  })) as unknown as Array<Record<string, unknown>>;

  const numero = (v: unknown) => Number(v || 0);

  return {
    receivables: rows,
    count,
    hasMore: count > pagina * porPagina,
    totais: {
      total: numero(totais?.total),
      recebido: numero(totais?.recebido),
      aberto: numero(totais?.total) - numero(totais?.recebido),
      vencido: numero(totais?.vencido)
    }
  };
};

export default ListReceivablesService;
