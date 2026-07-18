import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Settings", "companyId", {
      type: DataTypes.INTEGER,
      references: { model: "Companies", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Settings", "companyId");
  }
};
