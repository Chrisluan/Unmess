import { QueryInterface, DataTypes } from "sequelize";

/**
 * Campos necessários para distribuição automática de chats:
 * - maxSimultaneousTickets: teto de atendimentos abertos por atendente (0 = ilimitado)
 * - online: presença do atendente, atualizada pelo socket
 * - lastSeenAt: último sinal de vida, usado como desempate no rodízio
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.addColumn("Users", "maxSimultaneousTickets", {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }),
      queryInterface.addColumn("Users", "online", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }),
      queryInterface.addColumn("Users", "lastSeenAt", {
        type: DataTypes.DATE,
        allowNull: true
      })
    ]);
  },

  down: async (queryInterface: QueryInterface) => {
    await Promise.all([
      queryInterface.removeColumn("Users", "maxSimultaneousTickets"),
      queryInterface.removeColumn("Users", "online"),
      queryInterface.removeColumn("Users", "lastSeenAt")
    ]);
  }
};
