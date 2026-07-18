import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // companyId já foi adicionado em migration anterior (20260718100007)
    // Aqui trocamos a PK de "key" para um novo "id" autoincrement,
    // e "key" passa a ser único por companyId (não mais globalmente).

    // 1) Remove a PK atual (key)
    await queryInterface.sequelize.query(
      "ALTER TABLE `Settings` DROP PRIMARY KEY;"
    );

    // 2) Adiciona coluna id como PK autoincrement.
    // Feito via SQL explícito (em vez de addColumn) porque no MySQL uma
    // coluna AUTO_INCREMENT precisa ser definida como chave (aqui, PRIMARY
    // KEY) no mesmo statement em que é criada.
    await queryInterface.sequelize.query(
      "ALTER TABLE `Settings` ADD COLUMN `id` INT NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (`id`);"
    );

    // 3) key deixa de ser PK, vira coluna comum (ainda NOT NULL)
    await queryInterface.changeColumn("Settings", "key", {
      type: DataTypes.STRING,
      allowNull: false
    });

    // 4) key único por empresa
    await queryInterface.addIndex("Settings", ["key", "companyId"], {
      unique: true,
      name: "settings_key_company_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "Settings",
      "settings_key_company_unique"
    );
    await queryInterface.removeColumn("Settings", "id");
    await queryInterface.sequelize.query(
      "ALTER TABLE `Settings` ADD PRIMARY KEY (`key`);"
    );
  }
};
