import { QueryInterface } from "sequelize";

/**
 * Marca os cards que já chegaram ao faturamento e ficaram sem `wonAt`.
 *
 * A primeira versão de `MarcarGanhoService` marcava uma vez por jornada
 * (`rootDealId`), partindo da ideia de que a jornada é uma linha reta de um
 * quadro para o outro. Ela se ramifica: um orçamento aprovado abre vários
 * cards adiante, e cada um chega ao faturamento por conta própria. Do segundo
 * em diante, o card ia para a coluna de ganho e nada era gravado -- o número
 * no topo do CRM não se mexia.
 *
 * O código já foi corrigido para marcar por card. Falta o que passou pela
 * coluna enquanto a regra antiga valia.
 *
 * Dois casos entram:
 *
 * - `status = 'won'` — chegou ao fim da fila de quadros, que é um faturamento
 *   por definição;
 * - parado numa coluna marcada como ganho — cruzou a marca e ficou lá.
 *
 * A data usada é a da última alteração do card, e não `NOW()`: o faturamento
 * aconteceu quando o card se moveu, não quando esta migration rodou. É uma
 * aproximação, mas põe o registro no dia certo.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE Deals d
         LEFT JOIN PipelineStages ps ON ps.id = d.stageId
          SET d.wonAt = COALESCE(d.closedAt, d.updatedAt)
        WHERE d.wonAt IS NULL
          AND d.status <> 'lost'
          AND (d.status = 'won' OR ps.isWon = 1)`
    );
  },

  /**
   * Sem volta.
   *
   * Desfazer significaria apagar datas de faturamento sem saber quais vieram
   * daqui e quais foram gravadas depois pelo uso normal do sistema.
   */
  down: async () => {
    // nada a desfazer
  }
};
