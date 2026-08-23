import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fundação do módulo financeiro.
 *
 * Cinco tabelas que sustentam receber, pagar e caixa. As contas a pagar chegam
 * depois e reaproveitam contas, categorias e lançamentos -- por isso os três
 * já nascem neutros, sem nada de "recebimento" na estrutura.
 *
 * Tudo por empresa. O sistema é um SaaS do setor de comunicação visual, e cada
 * empresa tem suas condições de pagamento, suas contas e seu plano de
 * categorias -- nada disso pode virar constante no código.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const empresa = {
      type: DataTypes.INTEGER,
      references: { model: "Companies", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      allowNull: false
    };
    const datas = {
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    };

    // ── Condições de pagamento ──────────────────────────────────────────────
    /**
     * "30/60/90" deixa de ser texto e vira regra.
     *
     * O campo era livre, e ninguém consegue calcular vencimento a partir de
     * "metade agora, resto na entrega". Com os prazos declarados, o pedido
     * faturado gera as parcelas sozinho.
     */
    await queryInterface.createTable("PaymentTerms", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING(60), allowNull: false },
      /**
       * Dias de vencimento de cada parcela, contados do faturamento.
       * `[0]` é à vista; `[30,60,90]` é a prazo; `[0,30]` é metade na hora.
       * O tamanho da lista é a quantidade de parcelas -- guardar o número
       * separado criaria duas fontes para o mesmo fato.
       */
      dayOffsets: { type: DataTypes.JSON, allowNull: false },
      /**
       * Percentual de cada parcela. Nulo divide em partes iguais, que é o
       * caso comum; declarado permite entrada maior que o resto.
       */
      percentages: { type: DataTypes.JSON, allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      companyId: empresa,
      ...datas
    });

    // ── Contas (caixa, banco, cartão) ───────────────────────────────────────
    await queryInterface.createTable("FinancialAccounts", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING(60), allowNull: false },
      /** cash | bank | card — onde o dinheiro efetivamente entra ou sai. */
      kind: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "cash" },
      /**
       * Saldo de onde a conta parte. Sem ele, o saldo do caixa começaria em
       * zero no dia em que o sistema entrou, ignorando o que já existia.
       */
      openingBalance: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      companyId: empresa,
      ...datas
    });

    // ── Categorias de receita e despesa ─────────────────────────────────────
    await queryInterface.createTable("FinancialCategories", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING(60), allowNull: false },
      /** income | expense */
      kind: { type: DataTypes.STRING(10), allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      companyId: empresa,
      ...datas
    });

    // ── Contas a receber ────────────────────────────────────────────────────
    /**
     * Uma linha por parcela.
     *
     * O status não é gravado: "em aberto", "parcial" e "quitada" saem da
     * comparação entre o valor e o que já foi baixado. Guardar o status criaria
     * uma segunda fonte de verdade, que diverge no instante em que alguém
     * estornar um pagamento. Só o cancelamento tem coluna, porque é decisão
     * humana e não se deduz de valor nenhum.
     */
    await queryInterface.createTable("Receivables", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      description: { type: DataTypes.STRING, allowNull: false },
      /** Posição desta parcela e o total delas: "2/3" na tela. */
      installment: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      installments: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      dueDate: { type: DataTypes.DATEONLY, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      canceledAt: { type: DataTypes.DATE, allowNull: true },
      canceledReason: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      /**
       * De onde a cobrança nasceu. SET NULL, e não CASCADE: apagar um card do
       * quadro não pode apagar dinheiro a receber do histórico.
       */
      dealId: {
        type: DataTypes.INTEGER,
        references: { model: "Deals", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      orderId: {
        type: DataTypes.INTEGER,
        references: { model: "Orders", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      customerId: {
        type: DataTypes.INTEGER,
        references: { model: "Customers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      paymentTermId: {
        type: DataTypes.INTEGER,
        references: { model: "PaymentTerms", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      categoryId: {
        type: DataTypes.INTEGER,
        references: { model: "FinancialCategories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      companyId: empresa,
      ...datas
    });

    // ── Lançamentos de caixa ────────────────────────────────────────────────
    /**
     * O movimento de dinheiro, de qualquer origem.
     *
     * Serve de baixa de uma conta a receber, de baixa de uma conta a pagar
     * (quando ela existir) e de lançamento avulso -- uma retirada, um aporte.
     * O fluxo de caixa é a soma desta tabela; não há outro lugar onde o
     * dinheiro se mexa.
     */
    await queryInterface.createTable("FinancialEntries", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      /** in | out — entrada ou saída de dinheiro. */
      direction: { type: DataTypes.STRING(4), allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      /**
       * Quando o dinheiro se moveu, que não é quando alguém digitou. Um
       * recebimento lançado na segunda pode ter acontecido no sábado, e é o
       * sábado que o caixa daquele dia precisa mostrar.
       */
      occurredAt: { type: DataTypes.DATEONLY, allowNull: false },
      /** cash | pix | debit | credit | boleto | transfer | check | other */
      method: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "cash" },
      description: { type: DataTypes.STRING, allowNull: true },
      accountId: {
        type: DataTypes.INTEGER,
        references: { model: "FinancialAccounts", key: "id" },
        onUpdate: "CASCADE",
        // A conta não some com movimento dentro; desativar é o caminho.
        onDelete: "RESTRICT",
        allowNull: false
      },
      /**
       * A parcela que esta baixa quita. CASCADE aqui é intencional e é o
       * oposto do resto: cancelar a cobrança sem levar as baixas junto
       * deixaria dinheiro no caixa apontando para o nada.
       */
      receivableId: {
        type: DataTypes.INTEGER,
        references: { model: "Receivables", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: true
      },
      categoryId: {
        type: DataTypes.INTEGER,
        references: { model: "FinancialCategories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      userId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      companyId: empresa,
      ...datas
    });

    /**
     * O negócio passa a apontar para a condição cadastrada.
     *
     * `paymentCondition` continua existindo e continua sendo texto livre: é
     * onde cabe o combinado que nenhuma regra expressa ("o resto quando a
     * fachada for instalada"). O que muda é que agora existe, ao lado, um
     * campo que a máquina lê para calcular vencimento.
     */
    await queryInterface.addColumn("Deals", "paymentTermId", {
      type: DataTypes.INTEGER,
      references: { model: "PaymentTerms", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });

    // As duas telas que mais consultam: "o que vence neste período" e "o que
    // entrou neste período". Sem índice, as duas varrem a tabela inteira.
    await queryInterface.addIndex("Receivables", ["companyId", "dueDate"], {
      name: "receivables_company_due"
    });
    await queryInterface.addIndex("FinancialEntries", ["companyId", "occurredAt"], {
      name: "entries_company_occurred"
    });
    await queryInterface.addIndex("FinancialEntries", ["receivableId"], {
      name: "entries_receivable"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Deals", "paymentTermId");
    await queryInterface.dropTable("FinancialEntries");
    await queryInterface.dropTable("Receivables");
    await queryInterface.dropTable("FinancialCategories");
    await queryInterface.dropTable("FinancialAccounts");
    await queryInterface.dropTable("PaymentTerms");
  }
};
