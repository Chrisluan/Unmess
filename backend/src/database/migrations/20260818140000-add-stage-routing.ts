import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

/**
 * Roteamento por coluna.
 *
 * Antes o fluxo era uma fila: a coluna final de um quadro mandava sempre para
 * o quadro seguinte. Agora cada quadro pode ter várias colunas finais, cada
 * uma apontando para um destino próprio — é o que permite "Ganho / produzir"
 * ir para Produção enquanto "Ganho / revenda" pula direto para Expedição.
 *
 * As colunas finais que já existiam ficam sem destino, o que preserva o
 * comportamento antigo: sem destino, segue a ordem dos quadros.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("PipelineStages", "isInitial", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("PipelineStages", "targetBoardId", {
      type: DataTypes.INTEGER,
      references: { model: "Boards", key: "id" },
      onUpdate: "CASCADE",
      // Apagar o quadro de destino não pode apagar a coluna de origem; ela só
      // volta a seguir a ordem da fila.
      onDelete: "SET NULL",
      allowNull: true
    });

    await queryInterface.addColumn("PipelineStages", "targetStageId", {
      type: DataTypes.INTEGER,
      references: { model: "PipelineStages", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      allowNull: true
    });

    // A primeira coluna de cada quadro vira a porta de entrada — era para lá
    // que o card ia antes, então isso mantém o comportamento.
    const quadros: { id: number }[] = await queryInterface.sequelize.query(
      "SELECT id FROM Boards",
      { type: QueryTypes.SELECT }
    );

    for (const quadro of quadros) {
      const [primeira]: { id: number }[] =
        await queryInterface.sequelize.query(
          "SELECT id FROM PipelineStages WHERE boardId = :boardId ORDER BY `order` ASC, id ASC LIMIT 1",
          {
            replacements: { boardId: quadro.id },
            type: QueryTypes.SELECT
          }
        );

      if (primeira) {
        await queryInterface.sequelize.query(
          "UPDATE PipelineStages SET isInitial = true WHERE id = :id",
          { replacements: { id: primeira.id }, type: QueryTypes.UPDATE }
        );
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("PipelineStages", "targetStageId");
    await queryInterface.removeColumn("PipelineStages", "targetBoardId");
    await queryInterface.removeColumn("PipelineStages", "isInitial");
  }
};
