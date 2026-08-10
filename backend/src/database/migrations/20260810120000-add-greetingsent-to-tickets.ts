import { QueryInterface, DataTypes } from "sequelize";

/**
 * Marca que a saudação do setor já foi enviada neste atendimento.
 *
 * Antes o envio dependia de `unreadMessages`, que o provider whaileys sempre
 * reporta como zero, e da conversa ainda estar sem setor — condição que nunca
 * acontece desde que o ticket passou a nascer no setor padrão. Um campo
 * próprio torna o controle explícito e sobrevive a reinício do processo.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "greetingSent", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "greetingSent");
  }
};
