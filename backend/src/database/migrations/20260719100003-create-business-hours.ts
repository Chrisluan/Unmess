import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("BusinessHours", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      weekDay: {
        // 0 = domingo ... 6 = sábado
        type: DataTypes.INTEGER,
        allowNull: false
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      startTime: {
        // formato "HH:mm"
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "08:00"
      },
      endTime: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "18:00"
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
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("BusinessHours");
  }
};
