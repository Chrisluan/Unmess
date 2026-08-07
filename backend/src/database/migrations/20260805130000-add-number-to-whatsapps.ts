import { QueryInterface, DataTypes } from "sequelize";

/**
 * Telefone autenticado na conexão, preenchido no momento em que a sessão abre.
 * Antes disso o número só existia dentro do JSON de credenciais, então nada
 * impedia parear duas conexões no mesmo aparelho — e o admin não tinha como
 * perceber, porque a tela de Conexões só mostra o nome que ele mesmo deu.
 *
 * Fica nulo até a próxima conexão de cada registro existente.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Whatsapps", "number", {
      type: DataTypes.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "number");
  }
};
