import { QueryInterface, DataTypes } from "sequelize";

/**
 * Numeração própria por empresa, e o pedido como registro separado.
 *
 * Até aqui o número exibido era o id da linha em Deals: compartilhado entre
 * todas as empresas e entre orçamento e pedido. Duas empresas nunca viam o
 * "orçamento 1", e o mesmo negócio mudava de identidade ao virar pedido.
 *
 * Sequences guarda um contador por empresa e por tipo. A numeração vem daqui, e
 * não de um MAX(numero)+1, porque duas pessoas fechando pedidos ao mesmo tempo
 * leriam o mesmo máximo e gravariam o mesmo número.
 *
 * Orders é o pedido: nasce quando o card deixa o funil de vendas e guarda de
 * qual orçamento veio.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Sequences", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      // "quote" (orçamento) | "order" (pedido)
      kind: { type: DataTypes.STRING(16), allowNull: false },
      lastNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // Um contador por empresa e tipo: o índice único é o que impede duas
    // linhas para a mesma contagem, e com elas duas numerações paralelas.
    await queryInterface.addIndex("Sequences", ["companyId", "kind"], {
      name: "sequences_company_kind_unique",
      unique: true
    });

    await queryInterface.createTable("Orders", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      // Número do pedido, sequencial dentro da empresa. Não é o id: o id é da
      // linha, este é o que o cliente vê e o que se procura no balcão.
      number: { type: DataTypes.INTEGER, allowNull: false },
      /**
       * Número do orçamento que originou este pedido.
       *
       * Guardado como valor, e não só como referência ao card: o orçamento
       * pode ser apagado, e o pedido continua tendo que dizer de onde veio.
       */
      quoteNumber: { type: DataTypes.INTEGER, allowNull: true },
      // Card do Kanban correspondente, quando ainda existe.
      dealId: {
        type: DataTypes.INTEGER,
        references: { model: "Deals", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "open"
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex("Orders", ["companyId", "number"], {
      name: "orders_company_number_unique",
      unique: true
    });

    // Número do orçamento no card. Fica no Deal porque é ele que vive no funil.
    await queryInterface.addColumn("Deals", "quoteNumber", {
      type: DataTypes.INTEGER,
      allowNull: true
    });

    await queryInterface.addIndex("Deals", ["companyId", "quoteNumber"], {
      name: "deals_company_quote_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Deals", "deals_company_quote_idx");
    await queryInterface.removeColumn("Deals", "quoteNumber");
    await queryInterface.dropTable("Orders");
    await queryInterface.dropTable("Sequences");
  }
};
