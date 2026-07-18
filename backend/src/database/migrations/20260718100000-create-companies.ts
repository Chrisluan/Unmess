import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("Companies", {
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
      document: {
        // CNPJ/CPF da empresa cliente do SaaS
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true
      },
      plan: {
        // free | basic | pro | enterprise
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "basic"
      },
      status: {
        // active | suspended | canceled
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "active"
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: true
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
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("Companies");
  }
};
