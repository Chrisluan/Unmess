import { QueryTypes } from "sequelize";
import sequelize from "../../database";

interface Request {
  companyId: number;
  de: string;
  ate: string;
}

export interface FluxoDeCaixa {
  /** Saldo somado de todas as contas até o dia anterior ao início. */
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
  /** Um ponto por dia com movimento, para o gráfico e a listagem. */
  dias: Array<{ dia: string; entradas: number; saidas: number; saldo: number }>;
  contas: Array<{ id: number; name: string; kind: string; saldo: number }>;
  /** O que ainda vai entrar: a receber em aberto, por vencimento no período. */
  previsto: number;
}

const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Fluxo de caixa do período — realizado, com o previsto ao lado.
 *
 * Realizado é a soma de `FinancialEntries`, que é a única tabela onde dinheiro
 * se move. Previsto é o que está a receber e vence no mesmo período. Os dois
 * juntos respondem a pergunta que o dono faz: "dá para pagar o fornecedor
 * sexta?" -- que o saldo de hoje sozinho não responde.
 *
 * Tudo em consultas agregadas. Um caixa de um ano são dezenas de milhares de
 * lançamentos, e trazê-los para somar em JavaScript carregaria a base inteira
 * a cada abertura da tela.
 */
const FluxoDeCaixaService = async ({
  companyId,
  de,
  ate
}: Request): Promise<FluxoDeCaixa> => {
  const replacements = { companyId, de, ate };

  /**
   * Saldo inicial: o que as contas trouxeram de abertura mais tudo que se
   * moveu antes do primeiro dia do período. Sem a abertura, o saldo começaria
   * em zero no dia em que o sistema entrou.
   */
  const [inicial] = await sequelize.query<Record<string, unknown>>(
    `SELECT
       (SELECT COALESCE(SUM(openingBalance), 0) FROM FinancialAccounts
         WHERE companyId = :companyId)
     + (SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END), 0)
          FROM FinancialEntries
         WHERE companyId = :companyId AND occurredAt < :de) AS saldo`,
    { replacements, type: QueryTypes.SELECT }
  );

  const dias = await sequelize.query<Record<string, unknown>>(
    `SELECT occurredAt AS dia,
            COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS saidas
       FROM FinancialEntries
      WHERE companyId = :companyId AND occurredAt BETWEEN :de AND :ate
      GROUP BY occurredAt
      ORDER BY occurredAt ASC`,
    { replacements, type: QueryTypes.SELECT }
  );

  const contas = await sequelize.query<Record<string, unknown>>(
    `SELECT a.id, a.name, a.kind,
            a.openingBalance
          + COALESCE((SELECT SUM(CASE WHEN e.direction = 'in' THEN e.amount ELSE -e.amount END)
                        FROM FinancialEntries e
                       WHERE e.accountId = a.id AND e.occurredAt <= :ate), 0) AS saldo
       FROM FinancialAccounts a
      WHERE a.companyId = :companyId AND a.active = true
      ORDER BY a.name ASC`,
    { replacements, type: QueryTypes.SELECT }
  );

  /**
   * O previsto ignora o que já foi baixado e o que foi cancelado: sobra o que
   * de fato ainda tem que entrar.
   */
  const [previsto] = await sequelize.query<Record<string, unknown>>(
    `SELECT COALESCE(SUM(r.amount - COALESCE(
              (SELECT SUM(fe.amount) FROM FinancialEntries fe WHERE fe.receivableId = r.id), 0)), 0) AS valor
       FROM Receivables r
      WHERE r.companyId = :companyId
        AND r.canceledAt IS NULL
        AND r.dueDate BETWEEN :de AND :ate`,
    { replacements, type: QueryTypes.SELECT }
  );

  const saldoInicial = numero(inicial?.saldo);

  let corrente = saldoInicial;
  let entradas = 0;
  let saidas = 0;

  const linhas = dias.map(linha => {
    const dentro = numero(linha.entradas);
    const fora = numero(linha.saidas);

    entradas += dentro;
    saidas += fora;
    corrente += dentro - fora;

    return {
      dia: String(linha.dia),
      entradas: dentro,
      saidas: fora,
      // Saldo acumulado do dia: é a linha que mostra quando o caixa vira.
      saldo: Number(corrente.toFixed(2))
    };
  });

  return {
    saldoInicial: Number(saldoInicial.toFixed(2)),
    entradas: Number(entradas.toFixed(2)),
    saidas: Number(saidas.toFixed(2)),
    saldoFinal: Number(corrente.toFixed(2)),
    dias: linhas,
    contas: contas.map(c => ({
      id: Number(c.id),
      name: String(c.name),
      kind: String(c.kind),
      saldo: numero(c.saldo)
    })),
    previsto: numero(previsto?.valor)
  };
};

export default FluxoDeCaixaService;
