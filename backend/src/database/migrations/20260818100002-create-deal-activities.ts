import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("DealActivities", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      // note | task | stage_change | created | won | lost
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "note"
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      // Só preenchidos quando type = "task"
      dueAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      doneAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      dealId: {
        type: DataTypes.INTEGER,
        references: { model: "Deals", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      // Nulo em registros automáticos gerados fora de uma requisição
      userId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("DealActivities", ["dealId", "createdAt"], {
      name: "deal_activities_deal_created"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("DealActivities");
  }
};
