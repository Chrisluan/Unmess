import { QueryInterface, DataTypes } from "sequelize";

/**
 * Quem escreveu a última mensagem do atendimento.
 *
 * A lista de conversas mostrava só o texto, então não dava para saber, sem
 * abrir, se a conversa estava esperando resposta nossa ou se o atendente já
 * havia respondido e a bola estava com o cliente. Nulo nas linhas anteriores
 * à coluna: nesses casos a lista simplesmente não marca a origem.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "lastMessageFromMe", {
      type: DataTypes.BOOLEAN,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "lastMessageFromMe");
  }
};
