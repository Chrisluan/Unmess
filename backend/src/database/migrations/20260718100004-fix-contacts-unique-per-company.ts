import { QueryInterface } from "sequelize";

// Remove dinamicamente qualquer índice UNIQUE existente sobre a coluna,
// sem depender de adivinhar o nome gerado automaticamente pelo Sequelize/MySQL
// (que normalmente é o próprio nome da coluna, mas pode variar).
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
    await removeUniqueIndexesOnColumn(queryInterface, "Contacts", "number");
    await removeUniqueIndexesOnColumn(queryInterface, "Contacts", "lid");

    await queryInterface.addIndex("Contacts", ["number", "companyId"], {
      unique: true,
      name: "contacts_number_company_unique"
    });

    await queryInterface.addIndex("Contacts", ["lid", "companyId"], {
      unique: true,
      name: "contacts_lid_company_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "Contacts",
      "contacts_number_company_unique"
    );
    await queryInterface.removeIndex(
      "Contacts",
      "contacts_lid_company_unique"
    );
  }
};
