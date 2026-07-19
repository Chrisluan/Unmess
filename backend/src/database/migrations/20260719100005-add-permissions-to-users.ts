import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Users", "permissionGroupId", {
      type: DataTypes.INTEGER,
      references: { model: "PermissionGroups", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });

    // Permissões específicas do usuário, além (ou no lugar) do grupo.
    // Formato: { "add": ["chats:delete"], "remove": ["users:manage"] }
    await queryInterface.addColumn("Users", "customPermissions", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Users", "permissionGroupId");
    await queryInterface.removeColumn("Users", "customPermissions");
  }
};
