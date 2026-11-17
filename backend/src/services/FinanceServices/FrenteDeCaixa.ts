import { Op, QueryTypes } from "sequelize";

import sequelize from "../../database";
import AppError from "../../errors/AppError";
import CashSession from "../../models/CashSession";
import CashMovement from "../../models/CashMovement";
import FinancialAccount from "../../models/FinancialAccount";
import FinancialEntry from "../../models/FinancialEntry";
import User from "../../models/User";

/**
 * Frente de caixa.
 *
 * Abrir o turno, registrar o que entra e sai da gaveta fora das vendas, e
 * fechar conferindo o que foi contado contra o que o sistema esperava.
 *
 * Tudo aqui gira em torno de uma pergunta só: quanto deveria ter na gaveta
 * agora? A resposta é sempre a mesma conta — abertura, mais o dinheiro que
 * entrou, menos o que saiu — e ela existe num lugar só, em `esperado`, porque
 * duas versões dela divergiriam e a diferença apontaria para o lugar errado.
 */

const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const arredondar = (v: number): number => Math.round(v * 100) / 100;

/** Só dinheiro vivo entra na conta da gaveta. */
const EM_ESPECIE = "cash";

export interface ResumoDaSessao {
  session: CashSession | null;
  /** Vendas em dinheiro registradas nesta sessão. */
  vendasEmEspecie: number;
  /** Vendas por outros meios — não estão na gaveta, mas contam no turno. */
  vendasPorOutrosMeios: number;
  suprimentos: number;
  sangrias: number;
  /** Abertura + vendas em espécie + suprimentos − sangrias. */
  esperado: number;
  movements: CashMovement[];
}

const daSessao = (sessionId: number) => ({
  where: { sessionId },
  order: [["createdAt", "ASC"]] as any
});

/**
 * Quanto deveria estar na gaveta.
 *
 * Só o que é dinheiro vivo entra: uma venda no PIX aumenta o caixa da empresa
 * e não muda nada dentro da gaveta, e somá-la aqui faria toda conferência
 * fechar com falta do valor exato das vendas eletrônicas — o tipo de erro que
 * manda o operador procurar dinheiro que nunca existiu.
 */
const calcularResumo = async (
  session: CashSession
): Promise<ResumoDaSessao> => {
  const [vendas] = await sequelize.query<Record<string, unknown>>(
    `SELECT
       COALESCE(SUM(CASE WHEN method = :especie THEN amount ELSE 0 END), 0) AS especie,
       COALESCE(SUM(CASE WHEN method <> :especie THEN amount ELSE 0 END), 0) AS outros
     FROM FinancialEntries
     WHERE companyId = :companyId
       AND accountId = :accountId
       AND direction = 'in'
       AND isTransfer = false
       AND createdAt >= :desde
       AND (:ate IS NULL OR createdAt <= :ate)`,
    {
      replacements: {
        especie: EM_ESPECIE,
        companyId: session.companyId,
        accountId: session.accountId,
        desde: session.openedAt,
        ate: session.closedAt ?? null
      },
      type: QueryTypes.SELECT
    }
  );

  const movements = await CashMovement.findAll({
    ...daSessao(session.id),
    include: [{ model: User, attributes: ["id", "name"], required: false }]
  });

  const suprimentos = movements
    .filter(m => m.direction === "in")
    .reduce((soma, m) => soma + m.amount, 0);

  const sangrias = movements
    .filter(m => m.direction === "out")
    .reduce((soma, m) => soma + m.amount, 0);

  const vendasEmEspecie = numero(vendas?.especie);

  return {
    session,
    vendasEmEspecie,
    vendasPorOutrosMeios: numero(vendas?.outros),
    suprimentos,
    sangrias,
    esperado: arredondar(
      session.openingAmount + vendasEmEspecie + suprimentos - sangrias
    ),
    movements
  };
};

/**
 * A sessão aberta de um caixa, ou de qualquer caixa da empresa.
 *
 * Sem `accountId`, devolve a primeira sessão aberta que a pessoa encontrar —
 * é o que a tela do PDV pede ao abrir, para não obrigar a escolher o caixa
 * quando só existe um turno em andamento.
 */
export const sessaoAberta = async (
  companyId: number,
  accountId?: number
): Promise<ResumoDaSessao | null> => {
  const session = await CashSession.findOne({
    where: {
      companyId,
      status: "open",
      ...(accountId ? { accountId } : {})
    },
    include: [
      { model: FinancialAccount, attributes: ["id", "name", "kind"] },
      { model: User, as: "openedBy", attributes: ["id", "name"] }
    ],
    order: [["openedAt", "DESC"]]
  });

  if (!session) return null;

  return calcularResumo(session);
};

/**
 * O resumo de um turno específico, pelo id.
 *
 * Existe porque `sessaoAberta` sem `accountId` devolve o primeiro turno
 * aberto que encontrar: quem acabou de vender no caixa da loja receberia o
 * resumo do caixa da fábrica se os dois estivessem abertos, e o número no topo
 * da tela passaria a ser de outra gaveta sem nenhum aviso.
 */
export const resumoPorSessao = async (
  companyId: number,
  sessionId: number
): Promise<ResumoDaSessao | null> => {
  const session = await CashSession.findOne({
    where: { id: sessionId, companyId },
    include: [
      { model: FinancialAccount, attributes: ["id", "name", "kind"] },
      { model: User, as: "openedBy", attributes: ["id", "name"] }
    ]
  });

  return session ? calcularResumo(session) : null;
};

export const abrir = async ({
  companyId,
  accountId,
  userId,
  openingAmount
}: {
  companyId: number;
  accountId: number;
  userId: number;
  openingAmount: number;
}): Promise<ResumoDaSessao> => {
  const conta = await FinancialAccount.findOne({
    where: { id: accountId, companyId }
  });

  if (!conta) {
    throw new AppError("Caixa não encontrado.", 404);
  }

  /**
   * O PDV só abre sobre conta de tipo "cash".
   *
   * Abrir turno sobre a conta do banco produziria uma conferência sem
   * sentido: não há gaveta para contar no fim do dia, e a diferença seria
   * sempre o valor de tudo que entrou por transferência.
   */
  if (conta.kind !== EM_ESPECIE) {
    throw new AppError(
      `"${conta.name}" não é um caixa em dinheiro. A frente de caixa abre ` +
        "turno apenas sobre contas do tipo Caixa.",
      400
    );
  }

  if (openingAmount < 0) {
    throw new AppError("O valor de abertura não pode ser negativo.", 400);
  }

  try {
    const session = await CashSession.create({
      companyId,
      accountId,
      openedById: userId,
      openedAt: new Date(),
      openingAmount,
      status: "open"
    } as any);

    return (await sessaoAberta(companyId, accountId)) ?? calcularResumo(session);
  } catch (err: any) {
    /**
     * O índice único do banco é quem garante um turno por caixa. Chegar aqui
     * significa que outra aba, ou outro clique, abriu primeiro — e a mensagem
     * certa é essa, não "erro ao salvar".
     */
    if (err?.name === "SequelizeUniqueConstraintError") {
      throw new AppError(
        `Este caixa já tem um turno aberto. Recarregue a tela para vê-lo.`,
        409
      );
    }
    throw err;
  }
};

/**
 * Sangria e suprimento.
 *
 * Os dois são transferência, e transferência tem dois lados. O dinheiro que
 * sai da gaveta vai para algum lugar — o cofre, o banco, a conta do dono — e
 * exigir esse destino não é burocracia: sem ele, o lançamento de saída faria o
 * dinheiro simplesmente desaparecer do sistema, e o total em caixa da empresa
 * encolheria todo dia sem que nada tivesse sido gasto.
 *
 * Sangria para pagar alguém não é sangria: é despesa, e tem lugar próprio em
 * contas a pagar. Aqui só passa dinheiro que muda de lugar.
 *
 * Os dois lançamentos e o movimento gravam na mesma transação. Qualquer
 * subconjunto é pior que nenhum: o movimento sem lançamento faz o saldo da
 * conta parar de bater com a gaveta, e um lado sem o outro faz o dinheiro
 * sumir ou aparecer do nada.
 */
export const registrarMovimento = async ({
  companyId,
  sessionId,
  userId,
  direction,
  amount,
  reason,
  counterAccountId
}: {
  companyId: number;
  sessionId: number;
  userId: number;
  direction: "in" | "out";
  amount: number;
  reason: string;
  /** De onde vem o suprimento, ou para onde vai a sangria. */
  counterAccountId: number;
}): Promise<ResumoDaSessao> => {
  const session = await CashSession.findOne({
    where: { id: sessionId, companyId }
  });

  if (!session) {
    throw new AppError("Turno de caixa não encontrado.", 404);
  }

  if (session.status !== "open") {
    throw new AppError(
      "Este turno já foi fechado. Abra um novo para registrar movimentos.",
      400
    );
  }

  if (!(amount > 0)) {
    throw new AppError("O valor precisa ser maior que zero.", 400);
  }

  const motivo = (reason || "").trim();

  if (motivo.length < 3) {
    throw new AppError(
      direction === "out"
        ? "Diga o motivo da sangria. Retirada sem motivo é dinheiro sumido com carimbo."
        : "Diga o motivo do suprimento.",
      400
    );
  }

  const contraparte = await FinancialAccount.findOne({
    where: { id: counterAccountId, companyId }
  });

  if (!contraparte) {
    throw new AppError(
      direction === "out"
        ? "Diga para onde vai o dinheiro. Se ainda não existe uma conta para o cofre ou o banco, cadastre-a em Configuração financeira."
        : "Diga de onde vem o dinheiro.",
      400
    );
  }

  if (contraparte.id === session.accountId) {
    throw new AppError(
      "A origem e o destino não podem ser o mesmo caixa.",
      400
    );
  }

  const resumoAtual = await calcularResumo(session);

  /**
   * Não se tira da gaveta o que não está nela.
   *
   * Sem esta conferência, uma sangria digitada com um zero a mais deixaria o
   * turno com saldo negativo, e o fechamento acusaria uma falta enorme sem
   * pista de onde ela nasceu.
   */
  if (direction === "out" && amount > resumoAtual.esperado) {
    throw new AppError(
      `A gaveta tem R$ ${resumoAtual.esperado.toFixed(2)}. ` +
        "Não é possível sangrar mais do que isso.",
      400
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const descricao =
    direction === "out"
      ? `Sangria para ${contraparte.name}: ${motivo}`
      : `Suprimento de ${contraparte.name}: ${motivo}`;

  await sequelize.transaction(async transaction => {
    const naGaveta = await FinancialEntry.create(
      {
        companyId,
        accountId: session.accountId,
        direction,
        amount,
        occurredAt: hoje,
        method: EM_ESPECIE,
        isTransfer: true,
        description: descricao,
        userId
      } as any,
      { transaction }
    );

    // O outro lado. Sem ele o dinheiro sumiria do total da empresa.
    await FinancialEntry.create(
      {
        companyId,
        accountId: contraparte.id,
        direction: direction === "out" ? "in" : "out",
        amount,
        occurredAt: hoje,
        method: EM_ESPECIE,
        isTransfer: true,
        description: descricao,
        userId
      } as any,
      { transaction }
    );

    await CashMovement.create(
      {
        companyId,
        sessionId: session.id,
        userId,
        direction,
        amount,
        reason: motivo,
        // Guarda o lado da gaveta: é o que a conferência do turno usa.
        entryId: naGaveta.id
      } as any,
      { transaction }
    );
  });

  return calcularResumo(session);
};

/**
 * Fecha o turno.
 *
 * `expectedAmount` e `difference` são gravados, e não recalculados na leitura:
 * um lançamento estornado meses depois mudaria a conta e faria a diferença de
 * um turno antigo aparecer diferente do que foi conferido no dia.
 *
 * A diferença não corrige nada. Sobra e falta são normais — troco errado,
 * venda digitada a mais —, e o que não pode é o número sumir. Ajustar o saldo
 * em silêncio para bater com a contagem apagaria exatamente o dado que faz
 * alguém procurar o erro.
 */
export const fechar = async ({
  companyId,
  sessionId,
  userId,
  closingAmount,
  notes
}: {
  companyId: number;
  sessionId: number;
  userId: number;
  closingAmount: number;
  notes?: string;
}): Promise<ResumoDaSessao> => {
  const session = await CashSession.findOne({
    where: { id: sessionId, companyId }
  });

  if (!session) {
    throw new AppError("Turno de caixa não encontrado.", 404);
  }

  if (session.status !== "open") {
    throw new AppError("Este turno já foi fechado.", 400);
  }

  if (closingAmount < 0) {
    throw new AppError("O valor contado não pode ser negativo.", 400);
  }

  const resumo = await calcularResumo(session);

  await session.update({
    status: "closed",
    closedById: userId,
    closedAt: new Date(),
    closingAmount,
    expectedAmount: resumo.esperado,
    difference: arredondar(closingAmount - resumo.esperado),
    notes: notes?.trim() || null
  });

  return calcularResumo(session);
};

/** Turnos já fechados, do mais recente para o mais antigo. */
export const listarSessoes = async ({
  companyId,
  accountId,
  de,
  ate,
  limite = 50
}: {
  companyId: number;
  accountId?: number;
  de?: string;
  ate?: string;
  limite?: number;
}): Promise<CashSession[]> =>
  CashSession.findAll({
    where: {
      companyId,
      ...(accountId ? { accountId } : {}),
      ...(de || ate
        ? {
            openedAt: {
              ...(de ? { [Op.gte]: new Date(de) } : {}),
              ...(ate ? { [Op.lte]: new Date(`${ate}T23:59:59`) } : {})
            }
          }
        : {})
    },
    include: [
      { model: FinancialAccount, attributes: ["id", "name"] },
      { model: User, as: "openedBy", attributes: ["id", "name"] },
      { model: User, as: "closedBy", attributes: ["id", "name"], required: false }
    ],
    order: [["openedAt", "DESC"]],
    limit: Math.min(limite, 200)
  });
