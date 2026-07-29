import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("Customers", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      // Razão social (PJ) ou nome completo (PF)
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // Nome fantasia, aplicável principalmente a clientes PJ
      tradeName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // "PF" (pessoa física) ou "PJ" (pessoa jurídica)
      personType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "PJ"
      },
      // CPF ou CNPJ
      document: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Inscrição estadual (opcional, geralmente PJ)
      stateRegistration: {
        type: DataTypes.STRING,
        allowNull: true
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true
      },
      whatsapp: {
        type: DataTypes.STRING,
        allowNull: true
      },
      zipCode: {
        type: DataTypes.STRING,
        allowNull: true
      },
      street: {
        type: DataTypes.STRING,
        allowNull: true
      },
      addressNumber: {
        type: DataTypes.STRING,
        allowNull: true
      },
      complement: {
        type: DataTypes.STRING,
        allowNull: true
      },
      neighborhood: {
        type: DataTypes.STRING,
        allowNull: true
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true
      },
      state: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Ramo de atividade do cliente (ex: padaria, academia, loja de roupas)
      segment: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Origem do lead (ex: Indicação, Site, Redes sociais, Google, WhatsApp)
      origin: {
        type: DataTypes.STRING,
        allowNull: true
      },
      // Situação do cliente no funil comercial: lead | active | inactive
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "lead"
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      // Vínculo opcional com o Contact do WhatsApp (para puxar histórico de conversas)
      contactId: {
        type: DataTypes.INTEGER,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true
      },
      // Vendedor/atendente responsável pelo cliente
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
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("Customers");
  }
};
