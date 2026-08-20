import { QueryInterface, DataTypes } from "sequelize";

/**
 * Catálogo de produtos e serviços.
 *
 * Até aqui cada item do orçamento era texto digitado na hora. Isso significa
 * que "Adesivo impressão digital" e "adesivo imp. digital" eram coisas
 * diferentes para o sistema: não dava para saber o que mais se vende, o preço
 * variava por memória de quem digitou, e cada orçamento repetia o mesmo
 * trabalho de escrever tudo de novo.
 *
 * O item continua aceitando texto livre -- há sempre o serviço avulso que não
 * vale cadastrar --, mas quando vier do catálogo passa a apontar para ele.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Products", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: { type: DataTypes.STRING, allowNull: false },
      // Código interno ou de fábrica, para quem procura pelo número.
      code: { type: DataTypes.STRING(40), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      unit: {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: "un"
      },
      price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      // Custo guardado à parte do preço: é o que permite saber a margem sem
      // recalcular de cabeça a cada orçamento.
      cost: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      category: { type: DataTypes.STRING(60), allowNull: true },
      /**
       * Desativar em vez de excluir.
       *
       * Um produto que saiu de linha não pode sumir: os orçamentos antigos
       * apontam para ele, e apagá-lo deixaria o histórico com itens órfãos.
       */
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    // A busca do catálogo é sempre dentro da empresa e pelo nome.
    await queryInterface.addIndex("Products", ["companyId", "name"], {
      name: "products_company_name_idx"
    });

    await queryInterface.addIndex("Products", ["companyId", "code"], {
      name: "products_company_code_idx"
    });

    /**
     * O item do orçamento passa a poder apontar para o catálogo.
     *
     * SET NULL, e não CASCADE: se o produto for removido um dia, o item
     * continua no orçamento com a descrição e o preço que valeram naquele
     * momento -- que é o que o cliente aprovou.
     */
    await queryInterface.addColumn("DealItems", "productId", {
      type: DataTypes.INTEGER,
      references: { model: "Products", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("DealItems", "productId");
    await queryInterface.dropTable("Products");
  }
};
