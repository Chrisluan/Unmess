import { QueryInterface, QueryTypes } from "sequelize";

/**
 * `rootDealId` nasceu com ON DELETE SET NULL, o que desamarrava a jornada
 * inteira ao excluir o primeiro card: os cards seguintes viravam órfãos e o
 * resumo passava a contar cada um como uma venda separada.
 *
 * Com CASCADE, apagar a raiz apaga a jornada toda — que é o significado de
 * excluir um negócio.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const [constraint]: { name: string }[] =
      await queryInterface.sequelize.query(
        `SELECT CONSTRAINT_NAME AS name
           FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'Deals'
            AND COLUMN_NAME = 'rootDealId'
            AND REFERENCED_TABLE_NAME = 'Deals'`,
        { type: QueryTypes.SELECT }
      );

    if (constraint) {
      await queryInterface.sequelize.query(
        `ALTER TABLE Deals DROP FOREIGN KEY \`${constraint.name}\``
      );
    }

    // Cadeias já quebradas por exclusão anterior não têm como ser
    // reconstruídas; o que dá para fazer é impedir que aconteça de novo.
    await queryInterface.sequelize.query(
      `ALTER TABLE Deals
         ADD CONSTRAINT deals_root_deal_fk
         FOREIGN KEY (rootDealId) REFERENCES Deals(id)
         ON UPDATE CASCADE ON DELETE CASCADE`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize
      .query("ALTER TABLE Deals DROP FOREIGN KEY `deals_root_deal_fk`")
      .catch(() => {});

    await queryInterface.sequelize.query(
      `ALTER TABLE Deals
         ADD CONSTRAINT deals_root_deal_fk
         FOREIGN KEY (rootDealId) REFERENCES Deals(id)
         ON UPDATE CASCADE ON DELETE SET NULL`
    );
  }
};
