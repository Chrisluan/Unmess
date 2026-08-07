import { QueryInterface, DataTypes } from "sequelize";

/**
 * Marca mensagens que tiveram o texto reescrito depois de enviadas. O WhatsApp
 * mostra "editada" na bolha do destinatário; sem registrar aqui, o histórico do
 * atendimento exibiria o texto novo sem indicar que houve alteração.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Messages", "isEdited", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Messages", "isEdited");
  }
};
