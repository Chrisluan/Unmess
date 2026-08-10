import { QueryInterface, DataTypes } from "sequelize";

/**
 * Contato conhecido: dono, gerente, equipe interna, fornecedor recorrente.
 *
 * A conversa acontece normalmente — mensagem, notificação, histórico — mas não
 * entra na fila de Oportunidades, porque essas pessoas não são demanda
 * comercial a ser distribuída. Elas apareciam ali todo dia, inflando a fila e
 * distorcendo o tempo de espera.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Contacts", "isKnown", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Contacts", "isKnown");
  }
};
