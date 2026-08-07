import { QueryInterface, DataTypes } from "sequelize";

/**
 * Marca mensagens que saíram pelo aplicativo do WhatsApp no celular, e não
 * por este sistema. Só faz sentido quando fromMe é verdadeiro.
 *
 * Sem isso o atendente não distingue o que foi respondido pelo painel do que
 * alguém respondeu direto pelo aparelho, e o histórico do atendimento parece
 * ter lacunas.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Messages", "fromApp", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Messages", "fromApp");
  }
};
