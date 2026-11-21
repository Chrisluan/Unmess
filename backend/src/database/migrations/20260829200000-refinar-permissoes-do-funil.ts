import { QueryInterface, QueryTypes } from "sequelize";

/**
 * Quatro permissões novas, e nenhum acesso perdido no caminho.
 *
 * "Mover entre colunas" fazia três coisas ao mesmo tempo: arrastar o card,
 * fechar a venda e dar por perdida. "Editar" fazia outras três: mexer no
 * orçamento, dar desconto e passar o card para outra pessoa. Cotar e fechar
 * costumam ser de gente diferente numa gráfica, e desconto é onde a margem
 * evapora — as três valiam a pena separar.
 *
 * Separar uma permissão em duas é, para quem já usava o sistema, uma forma
 * silenciosa de tirar acesso: quem tinha `crm:move` na segunda-feira e não
 * consegue mais fechar venda na terça não vai ligar uma coisa à outra. Por
 * isso cada cargo que já tinha a permissão ampla recebe as derivadas dela
 * agora, uma única vez. Quem administra decide depois de quem tirar — que é
 * uma decisão informada, e não um efeito colateral de um deploy.
 *
 * O mesmo vale para `products:viewCost`: o custo sempre esteve visível para
 * quem abre o catálogo, e escondê-lo de todo mundo de uma vez transformaria
 * uma permissão nova em um defeito relatado.
 *
 * O Administrador não aparece aqui: ele lê o catálogo em tempo de execução e
 * já nasce com toda permissão criada, hoje e amanhã.
 */

/** A permissão que se ganha, e a que já se precisava ter para ganhá-la. */
const DERIVADAS: Array<[nova: string, deQuem: string]> = [
  ["crm:close", "crm:move"],
  ["crm:discount", "crm:edit"],
  ["crm:assign", "crm:edit"],
  ["products:viewCost", "products:view"]
];

interface LinhaDeCargo {
  id: number;
  permissions: string | null;
}

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const cargos = await queryInterface.sequelize.query<LinhaDeCargo>(
      "SELECT id, permissions FROM Roles",
      { type: QueryTypes.SELECT }
    );

    await Promise.all(
      cargos.map(async cargo => {
        let atuais: string[];

        try {
          const lido = JSON.parse(cargo.permissions || "[]");
          atuais = Array.isArray(lido) ? lido.filter(p => typeof p === "string") : [];
        } catch {
          // Cargo com JSON estragado é problema de outra ordem; esta migração
          // não é o lugar de consertá-lo, e reescrevê-lo com um palpite seria
          // pior do que deixá-lo como está.
          return;
        }

        const finais = new Set(atuais);

        DERIVADAS.forEach(([nova, deQuem]) => {
          if (finais.has(deQuem)) finais.add(nova);
        });

        if (finais.size === atuais.length) return;

        await queryInterface.sequelize.query(
          "UPDATE Roles SET permissions = :permissions WHERE id = :id",
          {
            replacements: {
              id: cargo.id,
              permissions: JSON.stringify(Array.from(finais))
            },
            type: QueryTypes.UPDATE
          }
        );
      })
    );
  },

  /**
   * Desfazer remove as permissões novas de onde quer que estejam.
   *
   * Não tenta distinguir "veio desta migração" de "alguém concedeu depois":
   * as permissões deixam de existir no catálogo ao voltar o código, e o
   * `sanitizar` as descartaria na primeira leitura de qualquer forma.
   */
  down: async (queryInterface: QueryInterface) => {
    const cargos = await queryInterface.sequelize.query<LinhaDeCargo>(
      "SELECT id, permissions FROM Roles",
      { type: QueryTypes.SELECT }
    );

    const novas = new Set(DERIVADAS.map(([nova]) => nova));

    await Promise.all(
      cargos.map(async cargo => {
        let atuais: string[];

        try {
          const lido = JSON.parse(cargo.permissions || "[]");
          atuais = Array.isArray(lido) ? lido.filter(p => typeof p === "string") : [];
        } catch {
          return;
        }

        const finais = atuais.filter(p => !novas.has(p));

        if (finais.length === atuais.length) return;

        await queryInterface.sequelize.query(
          "UPDATE Roles SET permissions = :permissions WHERE id = :id",
          {
            replacements: { id: cargo.id, permissions: JSON.stringify(finais) },
            type: QueryTypes.UPDATE
          }
        );
      })
    );
  }
};
