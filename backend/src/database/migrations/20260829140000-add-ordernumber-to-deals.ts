import { QueryInterface, DataTypes, QueryTypes } from "sequelize";

/**
 * Contagem própria de ordem de produção para cada empresa.
 *
 * Orçamento e pedido já tinham numeração por empresa, em Sequences. A ordem de
 * produção não: fora do funil de vendas, o card não recebia número nenhum e a
 * tela caía no `Deals.id` -- o contador da linha no banco, único para o
 * sistema inteiro. Numa instalação com mais de uma empresa isso significava
 * que nenhuma delas veria a ordem nº 1, e que a numeração de cada uma pulava
 * conforme o movimento das outras.
 *
 * O número fica no card, e não só em Orders, porque a jornada troca de linha a
 * cada quadro: Orders aponta para um card só, e o mesmo trabalho precisa
 * manter o número de Produção até Expedição.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Deals", "orderNumber", {
      type: DataTypes.INTEGER,
      allowNull: true
    });

    await queryInterface.addIndex("Deals", ["companyId", "orderNumber"], {
      name: "deals_company_order_idx"
    });

    const { sequelize } = queryInterface;

    interface Linha {
      id: number;
      companyId: number;
      raiz: number;
      noFunil: number;
      numeroDoPedido: number | null;
    }

    const cards = await sequelize.query<Linha>(
      `SELECT d.id,
              d.companyId,
              COALESCE(d.rootDealId, d.id) AS raiz,
              COALESCE(b.isSalesFunnel, 0)  AS noFunil,
              o.number                      AS numeroDoPedido
         FROM Deals d
         LEFT JOIN Boards b ON b.id = d.boardId
         LEFT JOIN Orders o ON o.dealId = d.id`,
      { type: QueryTypes.SELECT }
    );

    // O número já existente na jornada manda. Um pedido gravado em Orders é o
    // número que o cliente ouviu; renumerá-lo agora quebraria a conversa.
    const numeroDaJornada = new Map<string, number>();

    cards.forEach(card => {
      if (!card.numeroDoPedido) return;
      const chave = `${card.companyId}:${card.raiz}`;
      const atual = numeroDaJornada.get(chave);
      if (atual === undefined || card.numeroDoPedido < atual) {
        numeroDaJornada.set(chave, Number(card.numeroDoPedido));
      }
    });

    // Jornadas de produção que nunca passaram pelo funil não têm número
    // nenhum: recebem um agora, na ordem em que nasceram, para a contagem da
    // empresa sair cronológica.
    const semNumeroPorEmpresa = new Map<number, number[]>();

    cards
      .filter(card => Number(card.noFunil) === 0)
      .forEach(card => {
        const chave = `${card.companyId}:${card.raiz}`;
        if (numeroDaJornada.has(chave)) return;

        const pendentes = semNumeroPorEmpresa.get(card.companyId) || [];
        if (!pendentes.includes(Number(card.raiz))) {
          pendentes.push(Number(card.raiz));
          semNumeroPorEmpresa.set(card.companyId, pendentes);
        }
      });

    // eslint-disable-next-line no-restricted-syntax
    for (const [companyId, raizes] of Array.from(semNumeroPorEmpresa)) {
      raizes.sort((a, b) => a - b);

      // O contador da empresa pode ainda não existir: uma instalação que nunca
      // fechou pedido não tem linha em Sequences.
      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(
        `INSERT INTO Sequences (companyId, kind, lastNumber, createdAt, updatedAt)
         VALUES (:companyId, 'order', 0, NOW(), NOW())
         ON DUPLICATE KEY UPDATE id = id`,
        { replacements: { companyId }, type: QueryTypes.INSERT }
      );

      // eslint-disable-next-line no-await-in-loop
      const [contador] = await sequelize.query<{ lastNumber: number }>(
        `SELECT lastNumber FROM Sequences
          WHERE companyId = :companyId AND kind = 'order'`,
        { replacements: { companyId }, type: QueryTypes.SELECT }
      );

      let proximo = Number(contador?.lastNumber || 0);

      raizes.forEach(raiz => {
        proximo += 1;
        numeroDaJornada.set(`${companyId}:${raiz}`, proximo);
      });

      // O contador avança junto: o próximo pedido de verdade não pode repetir
      // um número que esta migração acabou de distribuir.
      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(
        `UPDATE Sequences SET lastNumber = :proximo, updatedAt = NOW()
          WHERE companyId = :companyId AND kind = 'order'`,
        { replacements: { companyId, proximo }, type: QueryTypes.UPDATE }
      );
    }

    // Só os cards fora do funil recebem a marca: dentro dele o card é
    // orçamento, e quem o identifica é o quoteNumber.
    const porNumero = new Map<number, number[]>();

    cards
      .filter(card => Number(card.noFunil) === 0)
      .forEach(card => {
        const numero = numeroDaJornada.get(`${card.companyId}:${card.raiz}`);
        if (!numero) return;

        const ids = porNumero.get(numero) || [];
        ids.push(Number(card.id));
        porNumero.set(numero, ids);
      });

    // eslint-disable-next-line no-restricted-syntax
    for (const [numero, ids] of Array.from(porNumero)) {
      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(
        `UPDATE Deals SET orderNumber = :numero WHERE id IN (:ids)`,
        { replacements: { numero, ids }, type: QueryTypes.UPDATE }
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Deals", "deals_company_order_idx");
    await queryInterface.removeColumn("Deals", "orderNumber");
  }
};
