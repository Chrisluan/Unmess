import { QueryInterface, DataTypes } from "sequelize";

// Timestamps dedicados para cálculo eficiente de métricas do dashboard
// (tempo até a primeira resposta do atendente, tempo total de atendimento),
// evitando reprocessar todas as mensagens do ticket a cada consulta.
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "firstResponseAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("Tickets", "closedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "firstResponseAt");
    await queryInterface.removeColumn("Tickets", "closedAt");
  }
};
