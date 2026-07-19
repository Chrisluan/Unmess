import { QueryInterface, DataTypes } from "sequelize";

// Status "canônicos" do fluxo (pending, open, closed) continuam existindo
// como comportamento do sistema (fila de espera, em atendimento, encerrado).
// Esta tabela permite ao admin customizar os RÓTULOS de finalização
// (ex: "Resolvido", "Sem resposta", "Orçamento enviado"), sempre associados
// a um dos 3 status canônicos via a coluna "type".
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("TicketStatuses", {
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
        allowNull: true
      },
      type: {
        // a qual status canônico este rótulo pertence: pending | open | closed
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "closed"
      },
      isDefault: {
        // rótulo usado automaticamente quando o chat é fechado sem escolha manual
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
    return queryInterface.dropTable("TicketStatuses");
  }
};
