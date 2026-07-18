import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Tickets", "companyId", {
      type: DataTypes.INTEGER,
      references: { model: "Companies", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Tickets", "companyId");
  }
};
