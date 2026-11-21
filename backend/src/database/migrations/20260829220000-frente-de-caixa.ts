import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

/**
 * Frente de caixa: a sessão de trabalho de um caixa e o que se move nele.
 *
 * O caixa em si não é entidade nova — ele já existe como conta financeira de
 * tipo `cash`. O que faltava era o turno: de quando abriu até quando fechou,
 * com quanto começou, quanto o sistema esperava encontrar e quanto foi
 * contado de verdade.
 *
 * ── Por que cada passo confere antes de agir ────────────────────────────────
 *
 * DDL no MySQL não é transacional. Uma migração que cria cinco objetos e falha
 * no terceiro deixa os dois primeiros gravados e não se registra como
 * aplicada — e a próxima tentativa morre em "Duplicate column name" no passo
 * um, sem nunca chegar ao que de fato faltava. Foi exatamente o que aconteceu
 * na primeira execução desta migração.
 *
 * Por isso cada passo pergunta antes: coluna que já existe é pulada, tabela
 * que já existe é pulada. A migração pode ser rodada quantas vezes for preciso
 * e sempre termina no mesmo lugar.
 *
 * ── Por que a diferença é gravada, e não corrigida ──────────────────────────
 *
 * Fechar caixa com sobra ou falta é normal — troco errado, venda digitada a
 * mais, nota que caiu no chão. O que não pode é o número sumir. `difference`
 * fica gravado para render conversa amanhã; ajustar o saldo em silêncio para
 * bater com a contagem seria apagar exatamente o dado que faz alguém procurar
 * o erro.
 *
 * ── Por que sangria e suprimento viram lançamento ───────────────────────────
 *
 * Uma sangria tira dinheiro da gaveta. Se ela não virasse lançamento, o saldo
 * da conta "Caixa" — que é somado a partir dos lançamentos — cresceria para
 * sempre e nunca bateria com o que há dentro da gaveta.
 *
 * Mas ela também não é despesa: o dinheiro não saiu da empresa, mudou de
 * lugar. Daí `isTransfer`, que mantém o lançamento no saldo e o tira das
 * receitas e despesas. Sem essa marca, um mês de sangrias diárias apareceria
 * nas métricas como um mês de prejuízo.
 */

/**
 * As conferências vão pelo `information_schema` e comparam em minúsculas.
 *
 * O MySQL desta instalação guarda os nomes de tabela em caixa baixa
 * (`lower_case_table_names`), então comparar com "CashSessions" letra a letra
 * nunca casaria — e a migração recriaria o que já existe.
 */
const temTabela = async (
  queryInterface: QueryInterface,
  tabela: string
): Promise<boolean> => {
  const linhas = await queryInterface.sequelize.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(:tabela)`,
    { replacements: { tabela }, type: QueryTypes.SELECT }
  );
  return Number(linhas[0]?.n ?? 0) > 0;
};

const temColuna = async (
  queryInterface: QueryInterface,
  tabela: string,
  coluna: string
): Promise<boolean> => {
  const linhas = await queryInterface.sequelize.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(TABLE_NAME) = LOWER(:tabela)
        AND COLUMN_NAME = :coluna`,
    { replacements: { tabela, coluna }, type: QueryTypes.SELECT }
  );
  return Number(linhas[0]?.n ?? 0) > 0;
};

const temIndice = async (
  queryInterface: QueryInterface,
  tabela: string,
  indice: string
): Promise<boolean> => {
  const linhas = await queryInterface.sequelize.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND LOWER(TABLE_NAME) = LOWER(:tabela)
        AND INDEX_NAME = :indice`,
    { replacements: { tabela, indice }, type: QueryTypes.SELECT }
  );
  return Number(linhas[0]?.n ?? 0) > 0;
};

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    if (!(await temColuna(queryInterface, "FinancialEntries", "isTransfer"))) {
      await queryInterface.addColumn("FinancialEntries", "isTransfer", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    if (!(await temTabela(queryInterface, "CashSessions"))) {
      await queryInterface.createTable("CashSessions", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        // O caixa é uma conta financeira de tipo "cash".
        accountId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "FinancialAccounts", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT"
        },
        status: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: "open"
        },
        openedById: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT"
        },
        openedAt: { type: DataTypes.DATE, allowNull: false },
        openingAmount: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0
        },
        closedById: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        closedAt: { type: DataTypes.DATE, allowNull: true },
        /** O que foi contado na gaveta. */
        closingAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        /** O que o sistema esperava encontrar, congelado no fechamento. */
        expectedAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        /** Contado − esperado. Positivo é sobra, negativo é falta. */
        difference: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }

    /**
     * Um caixa aberto por vez, garantido pelo banco.
     *
     * Conferir em JavaScript antes de inserir deixa a janela entre a consulta
     * e a gravação: dois cliques no botão "Abrir caixa" abrem dois turnos, e a
     * partir daí toda venda cai num deles sem critério.
     *
     * O MySQL não tem índice parcial, então o truque é a coluna gerada: ela só
     * carrega o `accountId` enquanto a sessão está aberta e vira NULL quando
     * fecha — e NULLs não colidem num índice único. O resultado é "um turno
     * aberto por caixa, quantos fechados quiser".
     *
     * VIRTUAL, e não STORED, porque o MySQL recusa coluna gerada STORED cuja
     * coluna-base tenha chave estrangeira com ON UPDATE CASCADE — e `accountId`
     * tem. Com STORED, o ALTER falha com "Cannot add foreign key constraint",
     * mensagem que não aponta para o problema real e custou uma migração pela
     * metade para ser entendida. VIRTUAL não guarda o valor, e o índice único
     * sobre ela funciona igual.
     */
    if (!(await temColuna(queryInterface, "CashSessions", "openAccountId"))) {
      await queryInterface.sequelize.query(
        `ALTER TABLE CashSessions
           ADD COLUMN openAccountId INT
           GENERATED ALWAYS AS (CASE WHEN status = 'open' THEN accountId END) VIRTUAL,
           ADD UNIQUE INDEX cash_sessions_um_aberto_por_caixa (openAccountId)`
      );
    }

    if (!(await temTabela(queryInterface, "CashMovements"))) {
      await queryInterface.createTable("CashMovements", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        sessionId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "CashSessions", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        /** "in" = suprimento (entra troco), "out" = sangria (sai dinheiro). */
        direction: { type: DataTypes.STRING(4), allowNull: false },
        amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
        /** Obrigatório: sangria sem motivo é dinheiro sumido com carimbo. */
        reason: { type: DataTypes.STRING(255), allowNull: false },
        entryId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "FinancialEntries", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT"
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }

    /**
     * A venda de balcão.
     *
     * Não é uma oportunidade do funil, e não deve virar uma: o cliente que
     * entra pedindo dois adesivos não passa por cotação, aprovação nem
     * produção. Forçá-lo pelo CRM encheria o quadro de cards que nascem e
     * morrem no mesmo minuto, e estragaria toda métrica de conversão.
     *
     * A venda gera cobrança e lançamento como qualquer outra receita — é assim
     * que ela chega ao caixa, ao fluxo e às métricas. O que ela não tem é
     * jornada.
     */
    if (!(await temTabela(queryInterface, "CashSales"))) {
      await queryInterface.createTable("CashSales", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        sessionId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "CashSessions", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT"
        },
        /** Sequencial por empresa, para o cupom ter número. */
        number: { type: DataTypes.INTEGER, allowNull: false },
        total: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0
        },
        discount: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0
        },
        method: { type: DataTypes.STRING(12), allowNull: false },
        /** Opcional: venda de balcão costuma ser para quem não tem ficha. */
        customerId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Customers", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        receivableId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Receivables", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        entryId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "FinancialEntries", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT"
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!(await temTabela(queryInterface, "CashSaleItems"))) {
      await queryInterface.createTable("CashSaleItems", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        saleId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "CashSales", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        /**
         * O produto some do catálogo, a linha da venda fica.
         * Por isso o nome e o preço são copiados, e não lidos por join: o cupom
         * de ontem precisa continuar dizendo o que dizia ontem.
         */
        productId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Products", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        name: { type: DataTypes.STRING(255), allowNull: false },
        quantity: {
          type: DataTypes.DECIMAL(12, 3),
          allowNull: false,
          defaultValue: 1
        },
        unitPrice: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0
        },
        total: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false }
      });
    }

    /**
     * Índices com nome explícito, para a conferência acima ter o que procurar
     * numa segunda passada — o nome que o Sequelize inventaria sozinho não é
     * previsível o bastante para servir de chave de idempotência.
     *
     * Criados em sequência, e não em paralelo: DDL simultâneo na mesma tabela
     * disputa o mesmo bloqueio de metadados e o ganho seria nenhum.
     */
    const indices: Array<[string, string, string[], boolean]> = [
      // A sessão aberta é consultada a cada abertura de tela do PDV.
      ["CashSessions", "cash_sessions_empresa_status", ["companyId", "status"], false],
      ["CashMovements", "cash_movements_sessao", ["sessionId"], false],
      ["CashSales", "cash_sales_sessao", ["sessionId"], false],
      // O número do cupom não se repete dentro da mesma empresa.
      ["CashSales", "cash_sales_numero_por_empresa", ["companyId", "number"], true]
    ];

    await indices.reduce(
      (fila, [tabela, nome, campos, unico]) =>
        fila.then(async () => {
          if (await temIndice(queryInterface, tabela, nome)) return;
          await queryInterface.addIndex(tabela, campos, {
            name: nome,
            unique: unico
          });
        }),
      Promise.resolve()
    );
  },

  down: async (queryInterface: QueryInterface) => {
    if (await temTabela(queryInterface, "CashSaleItems")) {
      await queryInterface.dropTable("CashSaleItems");
    }
    if (await temTabela(queryInterface, "CashSales")) {
      await queryInterface.dropTable("CashSales");
    }
    if (await temTabela(queryInterface, "CashMovements")) {
      await queryInterface.dropTable("CashMovements");
    }
    if (await temTabela(queryInterface, "CashSessions")) {
      await queryInterface.dropTable("CashSessions");
    }
    if (await temColuna(queryInterface, "FinancialEntries", "isTransfer")) {
      await queryInterface.removeColumn("FinancialEntries", "isTransfer");
    }
  }
};
