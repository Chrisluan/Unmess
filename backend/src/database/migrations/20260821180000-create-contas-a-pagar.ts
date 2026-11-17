import { QueryInterface, DataTypes } from "sequelize";

/**
 * Contas a pagar e fornecedores.
 *
 * A outra ponta do caixa. `FinancialEntries` já sabia registrar saída, mas não
 * havia de onde uma saída nascer -- o fluxo de caixa mostrava entradas contra
 * um zero permanente, o que responde "quanto entrou" e não "sobrou quanto".
 *
 * `Payables` é espelho de `Receivables` de propósito: mesmas colunas, mesma
 * dedução de situação a partir das baixas, mesmo cancelamento explícito. Duas
 * estruturas diferentes para o mesmo problema custariam duas regras de
 * arredondamento, duas noções de "quitado" e o dobro de lugares para errar.
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

    await queryInterface.createTable("Suppliers", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      document: { type: DataTypes.STRING(24), allowNull: true },
      phone: { type: DataTypes.STRING(24), allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      companyId: empresa,
      ...datas
    });

    await queryInterface.createTable("Payables", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      description: { type: DataTypes.STRING, allowNull: false },
      installment: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      installments: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      dueDate: { type: DataTypes.DATEONLY, allowNull: false },
      amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      /**
       * Documento de origem: número da nota do fornecedor, do boleto, do
       * contrato. Texto livre porque cada fornecedor numera do seu jeito.
       */
      document: { type: DataTypes.STRING(60), allowNull: true },
      canceledAt: { type: DataTypes.DATE, allowNull: true },
      canceledReason: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      supplierId: {
        type: DataTypes.INTEGER,
        references: { model: "Suppliers", key: "id" },
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

    /**
     * A baixa de uma conta a pagar é o mesmo lançamento de caixa da baixa de
     * uma conta a receber, com direção invertida. Uma tabela de movimento só é
     * o que garante que o saldo do dia tenha um número, e não dois.
     */
    await queryInterface.addColumn("FinancialEntries", "payableId", {
      type: DataTypes.INTEGER,
      references: { model: "Payables", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      allowNull: true
    });

    await queryInterface.addIndex("Payables", ["companyId", "dueDate"], {
      name: "payables_company_due"
    });
    await queryInterface.addIndex("FinancialEntries", ["payableId"], {
      name: "entries_payable"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("FinancialEntries", "payableId");
    await queryInterface.dropTable("Payables");
    await queryInterface.dropTable("Suppliers");
  }
};
