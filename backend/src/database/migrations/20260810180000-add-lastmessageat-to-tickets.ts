import { QueryInterface, DataTypes } from "sequelize";

/**
 * Momento real da última mensagem do atendimento, informado pelo WhatsApp.
 *
 * A lista mostrava `updatedAt`, que é quando a linha foi gravada pelo relógio
 * do servidor — e divergia do horário exibido dentro da conversa, que usa o
 * horário do WhatsApp. Além do relógio, `updatedAt` muda em qualquer alteração
 * do ticket (atribuir atendente, trocar setor), o que reiniciava o contador de
 * espera sem o cliente ter escrito nada.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "lastMessageAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "lastMessageAt");
  }
};
