import { QueryInterface, DataTypes } from "sequelize";

/**
 * Preferências de cada pessoa.
 *
 * Um saco de JSON, e não uma coluna por preferência, porque nada aqui é
 * consultado pelo banco: são escolhas de tela, lidas inteiras no login e
 * gravadas inteiras quando mudam. A primeira delas são os módulos favoritos
 * do menu lateral — a lista de atalhos que abre a barra. Preferência nova
 * entra como chave nova, sem migração.
 *
 * Nulo é o estado normal de quem nunca mexeu em nada; a leitura trata isso
 * como "{}" em vez de exigir um valor padrão gravado em toda linha antiga.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Users", "preferences", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Users", "preferences");
  }
};
