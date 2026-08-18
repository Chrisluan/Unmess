import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

// Colunas dos quadros que não existiam antes. A última de cada lista é a
// coluna final, que conclui o quadro e empurra o card para o seguinte.
const COLUNAS_POR_QUADRO: Record<
  string,
  { name: string; color: string; type: string }[]
> = {
  Produção: [
    { name: "Na fila", color: "#90a4ae", type: "open" },
    { name: "Em produção", color: "#42a5f5", type: "open" },
    { name: "Acabamento", color: "#ab47bc", type: "open" },
    { name: "Pronto", color: "#66bb6a", type: "open" }
  ],
  Expedição: [
    { name: "A separar", color: "#90a4ae", type: "open" },
    { name: "Em rota", color: "#42a5f5", type: "open" },
    { name: "Entregue", color: "#66bb6a", type: "open" }
  ],
  Financeiro: [
    { name: "A faturar", color: "#90a4ae", type: "open" },
    { name: "Faturado", color: "#42a5f5", type: "open" },
    { name: "Pago", color: "#66bb6a", type: "open" }
  ]
};

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("PipelineStages", "boardId", {
      type: DataTypes.INTEGER,
      references: { model: "Boards", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
      allowNull: true
    });

    await queryInterface.addColumn("PipelineStages", "isFinal", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // O nome da coluna passa a ser único por quadro, não por empresa: "Pronto"
    // em Produção e "Pronto" em Expedição são colunas legítimas e diferentes.
    await queryInterface
      .removeIndex("PipelineStages", "pipeline_stages_name_company_unique")
      .catch(() => {
        // Índice pode não existir em bases criadas fora da sequência normal.
      });

    const quadros: { id: number; name: string; companyId: number }[] =
      await queryInterface.sequelize.query(
        "SELECT id, name, companyId FROM Boards",
        { type: QueryTypes.SELECT }
      );

    const agora = new Date();

    for (const quadro of quadros) {
      if (quadro.name === "Funil de Vendas") {
        // As etapas que já existiam eram o funil comercial; elas viram as
        // colunas deste quadro.
        await queryInterface.sequelize.query(
          "UPDATE PipelineStages SET boardId = :boardId WHERE companyId = :companyId AND boardId IS NULL",
          {
            replacements: { boardId: quadro.id, companyId: quadro.companyId },
            type: QueryTypes.UPDATE
          }
        );
        continue;
      }

      const colunas = COLUNAS_POR_QUADRO[quadro.name];
      if (!colunas) continue;

      await queryInterface.bulkInsert(
        "PipelineStages",
        colunas.map((coluna, indice) => ({
          name: coluna.name,
          color: coluna.color,
          type: coluna.type,
          order: indice,
          // A última coluna da lista conclui o quadro.
          isFinal: indice === colunas.length - 1,
          boardId: quadro.id,
          companyId: quadro.companyId,
          createdAt: agora,
          updatedAt: agora
        }))
      );
    }

    // "Ganho" era o encerramento do funil; agora é a coluna que conclui o
    // quadro de vendas e manda o card para Produção.
    await queryInterface.sequelize.query(
      "UPDATE PipelineStages SET isFinal = true, type = 'open' WHERE type = 'won'",
      { type: QueryTypes.UPDATE }
    );

    await queryInterface.addIndex("PipelineStages", ["name", "boardId"], {
      unique: true,
      name: "pipeline_stages_name_board_unique"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface
      .removeIndex("PipelineStages", "pipeline_stages_name_board_unique")
      .catch(() => {});

    // Só as colunas dos quadros criados por esta migration são removidas; as
    // do funil original ficam.
    await queryInterface.sequelize.query(
      `DELETE FROM PipelineStages WHERE boardId IN (
         SELECT id FROM Boards WHERE name IN ('Produção', 'Expedição', 'Financeiro')
       )`,
      { type: QueryTypes.DELETE }
    );

    await queryInterface.sequelize.query(
      "UPDATE PipelineStages SET type = 'won' WHERE isFinal = true",
      { type: QueryTypes.UPDATE }
    );

    await queryInterface.removeColumn("PipelineStages", "isFinal");
    await queryInterface.removeColumn("PipelineStages", "boardId");
  }
};
