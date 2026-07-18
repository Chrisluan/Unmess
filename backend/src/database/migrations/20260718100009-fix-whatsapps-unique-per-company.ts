import { QueryInterface } from "sequelize";

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
    await removeUniqueIndexesOnColumn(queryInterface, "Whatsapps", "name");

    await queryInterface.addIndex("Whatsapps", ["name", "companyId"], {
      unique: true,
      name: "whatsapps_name_company_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "Whatsapps",
      "whatsapps_name_company_unique"
    );
  }
};
