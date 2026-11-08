import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import {
  EscopoResolvido,
  condicaoSql
} from "../../helpers/permissions/escopos";

interface Request {
  companyId: number;
  de: string;
  ate: string;
  /** As contas que quem pediu alcança. Ausente é "sem restrição". */
  escopoDeContas?: EscopoResolvido;
}

export interface Fatia {
  rotulo: string;
  valor: number;
  quantidade: number;
}

export interface Metricas {
  /** Realizado no período: o que entrou, o que saiu e a diferença. */
  resultado: {
    receitas: number;
    despesas: number;
    resultado: number;
    /** Resultado sobre receitas, em pontos percentuais. Null sem receita. */
    margem: number | null;
  };
  /** DRE gerencial rasa: para onde o dinheiro foi e de onde veio. */
  receitasPorCategoria: Fatia[];
  despesasPorCategoria: Fatia[];
  /** Base da conciliação de maquininha, quando ela existir. */
  recebimentoPorForma: Fatia[];
  aReceber: {
    emAberto: number;
    vencido: number;
    /** A vencer, 1–15, 16–30, 31–60, 60+ dias de atraso. */
    envelhecimento: Fatia[];
  };
  aPagar: {
    emAberto: number;
    vencido: number;
  };
  /**
   * Quanto do faturamento do período veio de cada cliente.
   *
   * A pergunta por trás não é "quem compra mais", é "o que acontece se este
   * cliente parar de comprar". Em comunicação visual é comum três clientes
   * responderem por metade do faturamento, e isso não aparece em nenhum
   * outro número da tela.
   */
  topClientes: Array<Fatia & { participacao: number }>;
  /** Doze meses até o fim do período, para a evolução. */
  mensal: Array<{ mes: string; receitas: number; despesas: number }>;
  cobrancas: {
    /** Cobranças emitidas no período, pelo vencimento da parcela. */
    quantidade: number;
    valor: number;
    ticketMedio: number | null;
  };
}

const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fatias = (linhas: Record<string, unknown>[]): Fatia[] =>
  linhas.map(l => ({
    rotulo: String(l.rotulo ?? "Sem categoria"),
    valor: numero(l.valor),
    quantidade: numero(l.quantidade)
  }));

/**
 * Quanto já foi baixado numa parcela.
 *
 * Subconsulta, e não join com GROUP BY: o join multiplicaria a linha da
 * parcela por baixa, e todo outro agregado da mesma consulta sairia errado.
 * Mesmo raciocínio de ListReceivablesService — se um dia a regra de "quitado"
 * mudar, os dois lugares mudam juntos.
 */
const PAGO_RECEBER = `COALESCE((SELECT SUM(fe.amount) FROM FinancialEntries fe
                                 WHERE fe.receivableId = r.id), 0)`;

const PAGO_PAGAR = `COALESCE((SELECT SUM(fe.amount) FROM FinancialEntries fe
                               WHERE fe.payableId = p.id), 0)`;

/**
 * O retrato financeiro do período.
 *
 * Existe porque as outras telas do módulo respondem "quem me deve" e "quanto
 * tem na conta", e nenhuma responde "o negócio está indo bem". Faturamento
 * sem despesa não diz nada; saldo em conta menos ainda, porque ele sobe
 * quando se atrasa fornecedor.
 *
 * Tudo em consultas agregadas, como o fluxo de caixa. Um ano de operação são
 * dezenas de milhares de lançamentos, e trazê-los para somar em JavaScript
 * carregaria a base inteira a cada abertura da tela.
 *
 * Um aviso sobre o que estes números são: caixa, não competência. Uma entrada
 * aparece no mês em que o dinheiro entrou, não no mês em que a venda foi
 * feita. Para uma gráfica que fatura em 30/60 dias isso desloca o resultado, e
 * a tela diz isso em voz alta em vez de deixar a conta parecer um DRE contábil.
 */
const MetricasService = async ({
  companyId,
  de,
  ate,
  escopoDeContas
}: Request): Promise<Metricas> => {
  const replacements = { companyId, de, ate };

  /**
   * O escopo de contas recorta o que se move — receitas, despesas, formas de
   * pagamento, concentração por cliente. Não recorta "a receber" nem "a
   * pagar": uma parcela em aberto ainda não tem conta, e escondê-la exigiria
   * adivinhar em qual caixa ela vai cair.
   *
   * Interpolado, e não como `replacement`: os ids já são inteiros vindos de
   * `sanitizarIds`, e um `IN` de lista vazia não é SQL válido.
   */
  // Toda consulta abaixo também descarta `isTransfer`: sangria e suprimento
  // movem dinheiro entre contas da própria empresa, e contá-los como receita e
  // despesa faria o resultado do mês oscilar por dinheiro que nunca entrou nem
  // saiu. O fluxo de caixa, ao contrário, continua contando-os — lá a pergunta
  // é onde o dinheiro está, não se o negócio deu lucro.
  const conta = condicaoSql(escopoDeContas, "accountId");
  const contaE = condicaoSql(escopoDeContas, "e.accountId");

  const [totais] = await sequelize.query<Record<string, unknown>>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END), 0) AS receitas,
       COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS despesas
     FROM FinancialEntries
     WHERE companyId = :companyId AND occurredAt BETWEEN :de AND :ate
       AND ${conta}
        AND isTransfer = false`,
    { replacements, type: QueryTypes.SELECT }
  );

  const porCategoria = async (direcao: "in" | "out") =>
    sequelize.query<Record<string, unknown>>(
      `SELECT COALESCE(c.name, 'Sem categoria') AS rotulo,
              COALESCE(SUM(e.amount), 0) AS valor,
              COUNT(*) AS quantidade
         FROM FinancialEntries e
         LEFT JOIN FinancialCategories c ON c.id = e.categoryId
        WHERE e.companyId = :companyId
          AND e.direction = :direcao
          AND e.occurredAt BETWEEN :de AND :ate
          AND ${contaE}
          AND e.isTransfer = false
        GROUP BY rotulo
        ORDER BY valor DESC`,
      {
        replacements: { ...replacements, direcao },
        type: QueryTypes.SELECT
      }
    );

  const [receitasCat, despesasCat] = await Promise.all([
    porCategoria("in"),
    porCategoria("out")
  ]);

  const formas = await sequelize.query<Record<string, unknown>>(
    `SELECT method AS rotulo,
            COALESCE(SUM(amount), 0) AS valor,
            COUNT(*) AS quantidade
       FROM FinancialEntries
      WHERE companyId = :companyId
        AND direction = 'in'
        AND occurredAt BETWEEN :de AND :ate
        AND ${conta}
        AND isTransfer = false
      GROUP BY method
      ORDER BY valor DESC`,
    { replacements, type: QueryTypes.SELECT }
  );

  /**
   * A receber é uma foto de agora, não do período: "quanto me devem" não tem
   * recorte de data. O envelhecimento conta os dias a partir de hoje, que é o
   * que decide se vale a pena ligar para o cliente.
   */
  const [receber] = await sequelize.query<Record<string, unknown>>(
    `SELECT
       COALESCE(SUM(r.amount - ${PAGO_RECEBER}), 0) AS emAberto,
       COALESCE(SUM(CASE WHEN r.dueDate < CURDATE()
                         THEN r.amount - ${PAGO_RECEBER} ELSE 0 END), 0) AS vencido
     FROM Receivables r
     WHERE r.companyId = :companyId
       AND r.canceledAt IS NULL
       AND ${PAGO_RECEBER} < r.amount - 0.005`,
    { replacements, type: QueryTypes.SELECT }
  );

  const envelhecimento = await sequelize.query<Record<string, unknown>>(
    `SELECT
       CASE
         WHEN r.dueDate >= CURDATE() THEN 'A vencer'
         WHEN DATEDIFF(CURDATE(), r.dueDate) <= 15 THEN '1 a 15 dias'
         WHEN DATEDIFF(CURDATE(), r.dueDate) <= 30 THEN '16 a 30 dias'
         WHEN DATEDIFF(CURDATE(), r.dueDate) <= 60 THEN '31 a 60 dias'
         ELSE 'Mais de 60 dias'
       END AS rotulo,
       COALESCE(SUM(r.amount - ${PAGO_RECEBER}), 0) AS valor,
       COUNT(*) AS quantidade,
       -- Só para ordenar da mais recente para a mais velha; o rótulo sozinho
       -- ordenaria em ordem alfabética, que aqui não quer dizer nada.
       MIN(CASE
             WHEN r.dueDate >= CURDATE() THEN 0
             WHEN DATEDIFF(CURDATE(), r.dueDate) <= 15 THEN 1
             WHEN DATEDIFF(CURDATE(), r.dueDate) <= 30 THEN 2
             WHEN DATEDIFF(CURDATE(), r.dueDate) <= 60 THEN 3
             ELSE 4
           END) AS ordem
     FROM Receivables r
     WHERE r.companyId = :companyId
       AND r.canceledAt IS NULL
       AND ${PAGO_RECEBER} < r.amount - 0.005
     GROUP BY rotulo
     ORDER BY ordem ASC`,
    { replacements, type: QueryTypes.SELECT }
  );

  const [pagar] = await sequelize.query<Record<string, unknown>>(
    `SELECT
       COALESCE(SUM(p.amount - ${PAGO_PAGAR}), 0) AS emAberto,
       COALESCE(SUM(CASE WHEN p.dueDate < CURDATE()
                         THEN p.amount - ${PAGO_PAGAR} ELSE 0 END), 0) AS vencido
     FROM Payables p
     WHERE p.companyId = :companyId
       AND p.canceledAt IS NULL
       AND ${PAGO_PAGAR} < p.amount - 0.005`,
    { replacements, type: QueryTypes.SELECT }
  );

  /**
   * Concentração de receita: quanto entrou de cada cliente no período.
   *
   * Passa por Receivables porque é a parcela que sabe de quem é o dinheiro —
   * o lançamento em si só conhece a conta bancária. Baixa sem parcela (um
   * aporte, uma venda de balcão avulsa) não entra em cliente nenhum, e é por
   * isso que a soma daqui pode ser menor que a receita total.
   */
  const topClientes = await sequelize.query<Record<string, unknown>>(
    `SELECT COALESCE(cu.tradeName, cu.name, 'Sem cliente') AS rotulo,
            COALESCE(SUM(e.amount), 0) AS valor,
            COUNT(DISTINCT e.receivableId) AS quantidade
       FROM FinancialEntries e
       JOIN Receivables r ON r.id = e.receivableId
       LEFT JOIN Customers cu ON cu.id = r.customerId
      WHERE e.companyId = :companyId
        AND e.direction = 'in'
        AND e.occurredAt BETWEEN :de AND :ate
        AND ${contaE}
          AND e.isTransfer = false
      GROUP BY rotulo
      ORDER BY valor DESC
      LIMIT 10`,
    { replacements, type: QueryTypes.SELECT }
  );

  /**
   * Doze meses terminando no fim do período.
   *
   * O recorte é sempre de doze meses, e não o período escolhido: a evolução
   * existe justamente para dar o contexto que o período não dá. Um mês
   * excelente só se reconhece contra os onze anteriores.
   */
  const mensal = await sequelize.query<Record<string, unknown>>(
    `SELECT DATE_FORMAT(occurredAt, '%Y-%m') AS mes,
            COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount ELSE 0 END), 0) AS receitas,
            COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS despesas
       FROM FinancialEntries
      WHERE companyId = :companyId
        AND occurredAt > DATE_SUB(DATE_FORMAT(:ate, '%Y-%m-01'), INTERVAL 11 MONTH)
        AND occurredAt <= LAST_DAY(:ate)
        AND ${conta}
        AND isTransfer = false
      GROUP BY mes
      ORDER BY mes ASC`,
    { replacements, type: QueryTypes.SELECT }
  );

  const [cobrancas] = await sequelize.query<Record<string, unknown>>(
    `SELECT COUNT(*) AS quantidade,
            COALESCE(SUM(amount), 0) AS valor
       FROM Receivables
      WHERE companyId = :companyId
        AND canceledAt IS NULL
        AND dueDate BETWEEN :de AND :ate`,
    { replacements, type: QueryTypes.SELECT }
  );

  const receitas = numero(totais?.receitas);
  const despesas = numero(totais?.despesas);

  const recebidoPorCliente = topClientes.reduce(
    (soma, l) => soma + numero(l.valor),
    0
  );

  const quantidadeCobrancas = numero(cobrancas?.quantidade);
  const valorCobrancas = numero(cobrancas?.valor);

  return {
    resultado: {
      receitas,
      despesas,
      resultado: receitas - despesas,
      // Sem receita não existe margem — nem zero, nem cem. Devolver null deixa
      // a tela escrever "—" em vez de um número que seria mentira.
      margem: receitas > 0 ? ((receitas - despesas) / receitas) * 100 : null
    },
    receitasPorCategoria: fatias(receitasCat),
    despesasPorCategoria: fatias(despesasCat),
    recebimentoPorForma: fatias(formas),
    aReceber: {
      emAberto: numero(receber?.emAberto),
      vencido: numero(receber?.vencido),
      envelhecimento: fatias(envelhecimento)
    },
    aPagar: {
      emAberto: numero(pagar?.emAberto),
      vencido: numero(pagar?.vencido)
    },
    topClientes: fatias(topClientes).map(f => ({
      ...f,
      // Participação sobre o que foi identificado por cliente, não sobre a
      // receita total: dividir pelo total faria as fatias somarem menos de
      // 100% sem explicação, por causa das baixas sem parcela.
      participacao:
        recebidoPorCliente > 0 ? (f.valor / recebidoPorCliente) * 100 : 0
    })),
    mensal: mensal.map(l => ({
      mes: String(l.mes),
      receitas: numero(l.receitas),
      despesas: numero(l.despesas)
    })),
    cobrancas: {
      quantidade: quantidadeCobrancas,
      valor: valorCobrancas,
      ticketMedio:
        quantidadeCobrancas > 0 ? valorCobrancas / quantidadeCobrancas : null
    }
  };
};

export default MetricasService;
