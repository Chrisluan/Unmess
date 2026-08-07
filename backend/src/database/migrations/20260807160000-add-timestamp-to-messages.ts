import { QueryInterface, DataTypes } from "sequelize";

/**
 * Momento em que a mensagem foi realmente enviada, informado pelo WhatsApp.
 *
 * Até aqui a conversa exibia createdAt, que é quando o backend gravou a linha.
 * Nas mensagens que demoram a chegar — retentativa de decriptação, sessão
 * reconectando, fila acumulada — os dois valores divergem e a conversa aparece
 * com horário errado, às vezes fora de ordem.
 *
 * Nulo nas linhas antigas; a exibição cai em createdAt nesses casos.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Messages", "timestamp", {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Messages", "timestamp");
  }
};
