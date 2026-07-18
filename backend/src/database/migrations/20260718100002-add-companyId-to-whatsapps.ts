import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Whatsapps", "companyId", {
      type: DataTypes.INTEGER,
      references: { model: "Companies", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Whatsapps", "companyId");
  }
};
