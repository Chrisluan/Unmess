import { QueryInterface, DataTypes } from "sequelize";

const removeUniqueIndexesOnColumn = async (
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string
): Promise<void> => {
  const indexes = (await queryInterface.showIndex(tableName)) as any[];

  const indexNames = new Set(
    indexes
      .filter(
        (index: any) =>
          index.unique &&
          index.fields?.length === 1 &&
          index.fields[0].attribute === columnName
      )
      .map((index: any) => index.name)
  );

  await Promise.all(
    Array.from(indexNames).map(name =>
      queryInterface.removeIndex(tableName, name as string)
    )
  );
};

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Queues", "companyId", {
      type: DataTypes.INTEGER,
      references: { model: "Companies", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      allowNull: true
    });

    // Cores não precisam mais ser únicas globalmente (regra removida do
    // model); nomes de fila passam a ser únicos apenas por empresa.
    await removeUniqueIndexesOnColumn(queryInterface, "Queues", "name");
    await removeUniqueIndexesOnColumn(queryInterface, "Queues", "color");

    await queryInterface.addIndex("Queues", ["name", "companyId"], {
      unique: true,
      name: "queues_name_company_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Queues", "queues_name_company_unique");
    await queryInterface.removeColumn("Queues", "companyId");
  }
};
