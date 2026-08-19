import { QueryInterface, DataTypes } from "sequelize";

/**
 * Itens de um negócio — o que de fato está sendo vendido.
 *
 * Até aqui o negócio guardava só um valor total digitado à mão. Sem a lista de
 * itens não há como emitir ordem de serviço, conferir o que foi combinado, nem
 * saber por que o orçamento deu aquele número.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("DealItems", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      dealId: {
        type: DataTypes.INTEGER,
        references: { model: "Deals", key: "id" },
        onUpdate: "CASCADE",
        // O item não existe sem o negócio: apagar o negócio leva os itens junto.
        onDelete: "CASCADE",
        allowNull: false
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Fracionada porque nem tudo se vende por unidade: metro de lona, hora de
      // serviço, quilo de material.
      quantity: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 1
      },
      unit: {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: "un"
      },
      unitPrice: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      // Desconto por item, e não só no total: é comum fechar um item com
      // condição diferente do resto do pedido.
      discount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      // Ordem de exibição na ordem de serviço, definida por quem monta o pedido.
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    await queryInterface.addIndex("DealItems", ["dealId", "position"], {
      name: "deal_items_deal_position_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("DealItems");
  }
};
