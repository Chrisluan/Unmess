import { QueryInterface } from "sequelize";

/**
 * Dá nome aos cards que nasceram dentro de uma conversa.
 *
 * Criar um negócio pela tela do atendimento mandava só o título e o ticket, e
 * o card ficava com contato e cliente nulos — no quadro do CRM ele aparecia
 * sem nome nenhum, e só abrindo dava para saber de quem era. O caminho de
 * criação já foi corrigido; esta migração alcança o que já está gravado.
 *
 * Só toca em card sem contato **e** sem cliente: quem tem um dos dois já se
 * identifica no quadro, e sobrescrever uma escolha feita à mão seria pior que
 * o problema. O cliente sai nulo quando o contato não tem cadastro — aí o
 * nome do contato do WhatsApp basta para o card se apresentar.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE Deals d
      JOIN (
        SELECT dealId, MIN(ticketId) AS ticketId
        FROM DealTickets
        GROUP BY dealId
      ) dt ON dt.dealId = d.id
      JOIN Tickets t ON t.id = dt.ticketId
      LEFT JOIN Customers c
        ON c.contactId = t.contactId
       AND c.companyId = d.companyId
      SET d.contactId = t.contactId,
          d.customerId = c.id
      WHERE d.contactId IS NULL
        AND d.customerId IS NULL
        AND t.contactId IS NOT NULL
    `);
  },

  /**
   * Sem volta: depois de gravado, não há como distinguir o vínculo que esta
   * migração preencheu daquele que alguém escolheu na tela. Desfazer os dois
   * juntos apagaria trabalho de gente; deixar como está apenas mantém cards
   * corretamente identificados.
   */
  down: async () => undefined
};
