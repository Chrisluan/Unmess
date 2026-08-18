import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

/**
 * Quadros iniciais, na ordem em que o card os percorre.
 *
 * Financeiro fica por último de propósito: é a coluna final do último quadro
 * que marca a venda como faturada, e faturar depois de entregar é o fluxo
 * normal da operação.
 */
const QUADROS_PADRAO = [
  { name: "Funil de Vendas", color: "#2576d2" },
  { name: "Produção", color: "#ffa726" },
  { name: "Expedição", color: "#26a69a" },
  { name: "Financeiro", color: "#66bb6a" }
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Boards", {
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
      // Posição na fila de quadros: 0 é o primeiro
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    await queryInterface.addIndex("Boards", ["name", "companyId"], {
      unique: true,
      name: "boards_name_company_unique"
    });

    const empresas: { id: number }[] = await queryInterface.sequelize.query(
      "SELECT id FROM Companies",
      { type: QueryTypes.SELECT }
    );

    if (empresas.length === 0) return;

    const agora = new Date();

    await queryInterface.bulkInsert(
      "Boards",
      empresas.reduce(
        (acc: any[], empresa) =>
          acc.concat(
            QUADROS_PADRAO.map((quadro, indice) => ({
              name: quadro.name,
              color: quadro.color,
              order: indice,
              companyId: empresa.id,
              createdAt: agora,
              updatedAt: agora
            }))
          ),
        []
      )
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Boards");
  }
};
