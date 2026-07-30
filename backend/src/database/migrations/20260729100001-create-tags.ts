import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Tags", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      color: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "#2ecc71"
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

    // Nome de etiqueta é único dentro da empresa, não globalmente.
    await queryInterface.addIndex("Tags", ["name", "companyId"], {
      unique: true,
      name: "tags_name_company_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Tags");
  }
};
