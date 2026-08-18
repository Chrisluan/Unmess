import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Deals", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Valor estimado do negócio
      value: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      // Previsão de fechamento, usada para destacar cards atrasados
      expectedCloseAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      // open | won | lost — acompanha o type da etapa atual
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "open"
      },
      lostReason: {
        type: DataTypes.STRING,
        allowNull: true
      },
      closedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      // Posição do card dentro da coluna
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      stageId: {
        type: DataTypes.INTEGER,
        references: { model: "PipelineStages", key: "id" },
        onUpdate: "CASCADE",
        // Etapa com negócio dentro não pode sumir sem destino; o service
        // bloqueia a exclusão antes de chegar aqui.
        onDelete: "RESTRICT",
        allowNull: false
      },
      customerId: {
        type: DataTypes.INTEGER,
        references: { model: "Customers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      // Contato do WhatsApp, para abrir negócio de quem ainda não é cliente
      contactId: {
        type: DataTypes.INTEGER,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      responsibleUserId: {
        type: DataTypes.INTEGER,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
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

    // O board carrega sempre por empresa + etapa, ordenado por order.
    await queryInterface.addIndex("Deals", ["companyId", "stageId", "order"], {
      name: "deals_company_stage_order"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Deals");
  }
};
