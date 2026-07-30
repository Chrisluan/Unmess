import { QueryInterface, DataTypes } from "sequelize";

/**
 * Nota interna: mensagem visível só para a equipe, nunca enviada ao WhatsApp.
 * Fica na mesma tabela de mensagens para aparecer na linha do tempo do chat
 * na ordem cronológica correta.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Messages", "isInternal", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("Messages", "userId", {
      type: DataTypes.INTEGER,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Messages", "isInternal");
    await queryInterface.removeColumn("Messages", "userId");
  }
};
