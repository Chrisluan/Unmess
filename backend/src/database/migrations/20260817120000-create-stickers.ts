import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Stickers", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      // Nome que o atendente vê na gaveta; o arquivo em disco tem nome
      // aleatório e não diz nada a quem procura "a figurinha do bom dia".
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Guardado mesmo sendo sempre WebP depois da conversão: separa figurinha
      // parada de animada na hora de listar, sem abrir o arquivo.
      animated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      size: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      companyId: {
        type: DataTypes.INTEGER,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // A gaveta é sempre aberta filtrando por empresa e ordenando pelo nome.
    await queryInterface.addIndex("Stickers", ["companyId", "name"], {
      name: "stickers_company_name_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Stickers");
  }
};
