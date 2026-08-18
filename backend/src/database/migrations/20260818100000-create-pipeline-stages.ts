import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

// Etapas iniciais criadas para toda empresa. A lista fica escrita aqui, e não
// importada de um helper, para a migration continuar reproduzível mesmo que o
// funil padrão do sistema mude depois.
const ETAPAS_PADRAO = [
  { name: "Novo", color: "#90a4ae", type: "open" },
  { name: "Contato feito", color: "#42a5f5", type: "open" },
  { name: "Proposta enviada", color: "#ab47bc", type: "open" },
  { name: "Negociação", color: "#ffa726", type: "open" },
  { name: "Ganho", color: "#66bb6a", type: "won" },
  { name: "Perdido", color: "#ef5350", type: "lost" }
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("PipelineStages", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      color: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "#2576d2"
      },
      // Posição da coluna no board (da esquerda para a direita)
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      // open | won | lost — "won" e "lost" encerram o negócio
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "open"
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

    // Nome de etapa é único dentro da empresa, não globalmente.
    await queryInterface.addIndex("PipelineStages", ["name", "companyId"], {
      unique: true,
      name: "pipeline_stages_name_company_unique"
    });

    // Empresas que já existem precisam nascer com o funil pronto — um board
    // sem colunas não deixa nem criar o primeiro negócio.
    const empresas: { id: number }[] = await queryInterface.sequelize.query(
      "SELECT id FROM Companies",
      { type: QueryTypes.SELECT }
    );

    if (empresas.length > 0) {
      const agora = new Date();

      await queryInterface.bulkInsert(
        "PipelineStages",
        empresas.reduce(
          (acc: any[], empresa) =>
            acc.concat(
              ETAPAS_PADRAO.map((etapa, indice) => ({
                name: etapa.name,
                color: etapa.color,
                type: etapa.type,
                order: indice,
                companyId: empresa.id,
                createdAt: agora,
                updatedAt: agora
              }))
            ),
          []
        )
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PipelineStages");
  }
};
