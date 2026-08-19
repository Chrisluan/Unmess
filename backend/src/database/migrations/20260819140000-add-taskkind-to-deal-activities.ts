import { QueryInterface, DataTypes } from "sequelize";

/**
 * Categoria da tarefa.
 *
 * A tarefa já tinha texto e prazo, mas não dizia de que natureza era. Sem isso,
 * a lista de pendências de um negócio mistura "ligar para o cliente" com
 * "imprimir o banner" -- coisas de setores diferentes, com urgências
 * diferentes, indistinguíveis até alguém ler cada uma.
 *
 * Fica nulo em tudo que já existe e em tudo que não for tarefa: os carimbos do
 * sistema (mudança de etapa, criação, conclusão) não têm categoria.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("DealActivities", "taskKind", {
      type: DataTypes.STRING(24),
      allowNull: true
    });

    // A consulta que importa é "o que está pendente, por categoria", filtrando
    // pelo que ainda não foi concluído.
    await queryInterface.addIndex("DealActivities", ["companyId", "taskKind", "doneAt"], {
      name: "deal_activities_company_kind_done_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "DealActivities",
      "deal_activities_company_kind_done_idx"
    );
    await queryInterface.removeColumn("DealActivities", "taskKind");
  }
};
