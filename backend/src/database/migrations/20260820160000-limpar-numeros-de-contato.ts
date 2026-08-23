import { QueryInterface, QueryTypes } from "sequelize";

/**
 * Conserta os contatos gravados com o domínio do WhatsApp no número.
 *
 * Ao abrir atendimento chamando o contato, o número era gravado como
 * "554499572139@s.whatsapp.net". O atendimento procura o contato pelo número
 * normalizado (só dígitos), então esse cadastro nunca era reencontrado: a
 * primeira resposta do cliente criava um segundo contato, e com ele um segundo
 * atendimento para a mesma pessoa.
 *
 * A origem foi fechada no código (o provedor agora devolve o número sem
 * domínio, e o cadastro sanitiza de qualquer jeito). Falta o que já está no
 * banco.
 *
 * Quando o cadastro limpo já existe, este é o dono legítimo: tudo que apontava
 * para o cadastro sujo é repassado para ele e o sujo é removido. Não fosse
 * assim, o índice único (number, companyId) recusaria a limpeza.
 *
 * Os atendimentos duplicados **não** são fundidos. Cada um tem seu histórico de
 * mensagens, e juntá-los automaticamente reescreveria a conversa numa ordem que
 * ninguém conferiu. Depois desta migration os dois passam a apontar para o mesmo
 * contato, e quem atende encerra o que não serve.
 */

/** Tabelas que apontam para um contato e precisam seguir o cadastro sobrevivente. */
const TABELAS_COM_CONTATO = [
  "Tickets",
  "Messages",
  "Deals",
  "Customers",
  "ContactCustomFields"
];

interface ContatoSujo {
  id: number;
  number: string;
  companyId: number;
}

/**
 * A verificação é da coluna, não só da tabela: a lista atravessa versões do
 * sistema, e um UPDATE numa coluna que não existe aborta a limpeza inteira.
 */
const temColunaDeContato = async (
  queryInterface: QueryInterface,
  tabela: string
): Promise<boolean> => {
  try {
    const colunas = (await queryInterface.describeTable(tabela)) as Record<
      string,
      unknown
    >;
    return Boolean(colunas.contactId);
  } catch {
    return false;
  }
};

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sujos = await queryInterface.sequelize.query<ContatoSujo>(
      "SELECT id, number, companyId FROM Contacts WHERE number LIKE '%@%'",
      { type: QueryTypes.SELECT }
    );

    if (sujos.length === 0) return;

    const tabelas: string[] = [];
    for (const tabela of TABELAS_COM_CONTATO) {
      // eslint-disable-next-line no-await-in-loop
      if (await temColunaDeContato(queryInterface, tabela)) tabelas.push(tabela);
    }

    for (const sujo of sujos) {
      const limpo = String(sujo.number).replace(/[^0-9]/g, "");

      // Sem dígito nenhum não há para onde limpar; deixar como está preserva o
      // pouco que sobrou para quem for investigar.
      // eslint-disable-next-line no-continue
      if (!limpo) continue;

      // eslint-disable-next-line no-await-in-loop
      const [sobrevivente] = await queryInterface.sequelize.query<{ id: number }>(
        `SELECT id FROM Contacts
          WHERE number = :limpo AND companyId = :companyId AND id <> :id
          ORDER BY id ASC
          LIMIT 1`,
        {
          replacements: { limpo, companyId: sujo.companyId, id: sujo.id },
          type: QueryTypes.SELECT
        }
      );

      if (!sobrevivente) {
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.sequelize.query(
          "UPDATE Contacts SET number = :limpo, updatedAt = NOW() WHERE id = :id",
          { replacements: { limpo, id: sujo.id } }
        );
        // eslint-disable-next-line no-continue
        continue;
      }

      for (const tabela of tabelas) {
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.sequelize.query(
          `UPDATE ${tabela} SET contactId = :destino WHERE contactId = :origem`,
          { replacements: { destino: sobrevivente.id, origem: sujo.id } }
        );
      }

      // eslint-disable-next-line no-await-in-loop
      await queryInterface.sequelize.query(
        "DELETE FROM Contacts WHERE id = :id",
        { replacements: { id: sujo.id } }
      );
    }
  },

  /**
   * Sem volta.
   *
   * Desfazer significaria recriar cadastros duplicados e devolver um domínio
   * que nunca deveria ter sido gravado. O estado anterior era o defeito.
   */
  down: async () => {
    // nada a desfazer
  }
};
