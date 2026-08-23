import { QueryInterface, DataTypes } from "sequelize";

/**
 * Momento em que a venda foi ganha.
 *
 * O `status` respondia sozinho por duas perguntas diferentes: "onde o card
 * está no fluxo" e "esta venda foi fechada". Elas divergem assim que existe uma
 * coluna de ganho no meio do caminho -- a venda está ganha, e o trabalho
 * continua na Produção. Ao avançar, o card virava "moved" e o ganho sumia do
 * faturamento até a jornada chegar ao fim do último quadro.
 *
 * `wonAt` marca **um** card por jornada: aquele que cruzou a coluna de ganho.
 * Marcar todos os cards da cadeia faria o faturamento contar a mesma venda uma
 * vez por quadro percorrido.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Deals", "wonAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    // O que já faturava pelo fim da fila continua faturando: sem isto, o
    // histórico anterior à coluna de ganho desapareceria do indicador.
    await queryInterface.sequelize.query(
      `UPDATE Deals
          SET wonAt = COALESCE(closedAt, updatedAt)
        WHERE status = 'won' AND wonAt IS NULL`
    );

    await queryInterface.addIndex("Deals", ["companyId", "wonAt"], {
      name: "deals_company_won_at"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Deals", "deals_company_won_at");
    await queryInterface.removeColumn("Deals", "wonAt");
  }
};
