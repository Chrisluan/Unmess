import { QueryInterface, DataTypes } from "sequelize";

/**
 * Logo da empresa, exibida na barra lateral e no topo.
 *
 * Guarda só o nome do arquivo em disco (a pasta public já é servida), no mesmo
 * padrão de Messages.mediaUrl — assim o endereço completo continua sendo
 * montado pelo frontend a partir do host por onde ele entrou, e a imagem
 * funciona pela rede local, pelo nome da máquina e pela VPN.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Companies", "logo", {
      type: DataTypes.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Companies", "logo");
  }
};
