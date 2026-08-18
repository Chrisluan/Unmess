import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Deals", "boardId", {
      type: DataTypes.INTEGER,
      references: { model: "Boards", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      allowNull: true
    });

    /**
     * Primeiro card da jornada. Nulo significa que este card é a raiz — a
     * chave da cadeia é sempre `rootDealId || id`. Sem isso o relatório
     * contaria a mesma venda uma vez por quadro percorrido.
     */
    await queryInterface.addColumn("Deals", "rootDealId", {
      type: DataTypes.INTEGER,
      references: { model: "Deals", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });

    await queryInterface.addColumn("Deals", "previousDealId", {
      type: DataTypes.INTEGER,
      references: { model: "Deals", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });

    // Quando o card saiu do board por ter concluído o quadro.
    await queryInterface.addColumn("Deals", "archivedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    // Negócios que já existiam pertencem ao quadro da coluna em que estão.
    await queryInterface.sequelize.query(
      `UPDATE Deals d
         JOIN PipelineStages s ON s.id = d.stageId
        SET d.boardId = s.boardId`,
      { type: QueryTypes.UPDATE }
    );

    await queryInterface.addIndex("Deals", ["companyId", "boardId", "status"], {
      name: "deals_company_board_status"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface
      .removeIndex("Deals", "deals_company_board_status")
      .catch(() => {});

    await queryInterface.removeColumn("Deals", "archivedAt");
    await queryInterface.removeColumn("Deals", "previousDealId");
    await queryInterface.removeColumn("Deals", "rootDealId");
    await queryInterface.removeColumn("Deals", "boardId");
  }
};
