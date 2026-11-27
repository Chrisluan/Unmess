import { QueryInterface, QueryTypes } from "sequelize";

/**
 * Quatro permissões novas no funil, e nenhum acesso perdido no caminho.
 *
 *   crm:viewValues        — ver preços, descontos e totais
 *   crm:editItems         — montar e alterar os itens do orçamento
 *   crm:manageAttachments — anexar e remover material do pedido
 *   crm:issueOrder        — emitir a ordem de serviço
 *
 * Todas já eram possíveis para quem tinha `crm:view` ou `crm:edit`: valores
 * sempre apareceram para quem abria o funil, e itens, anexos e O.S. estavam
 * atrás de uma das duas. Cada cargo que tinha a permissão ampla recebe as
 * derivadas agora, uma única vez; quem administra decide depois de quem tirar.
 * É o mesmo raciocínio de `refinar-permissoes-do-funil`.
 *
 * Diferença em relação àquela: as exceções individuais também são migradas.
 * Uma pessoa com `crm:edit` liberado à mão (e não pelo cargo) perderia a
 * edição de itens do mesmo jeito silencioso.
 *
 * O Administrador não aparece aqui: ele lê o catálogo em tempo de execução.
 */

const DERIVADAS: Array<[nova: string, deQuem: string]> = [
  ["crm:viewValues", "crm:view"],
  ["crm:issueOrder", "crm:view"],
  ["crm:editItems", "crm:edit"],
  ["crm:manageAttachments", "crm:edit"]
];

const NOVAS = new Set(DERIVADAS.map(([nova]) => nova));

const lerLista = (cru: unknown): string[] | null => {
  try {
    const lido = JSON.parse(typeof cru === "string" && cru ? cru : "[]");
    return Array.isArray(lido) ? lido.filter(p => typeof p === "string") : null;
  } catch {
    // JSON estragado é problema de outra ordem; reescrevê-lo com um palpite
    // seria pior do que deixá-lo como está.
    return null;
  }
};

const acrescentar = (atuais: string[]): string[] => {
  const finais = new Set(atuais);
  DERIVADAS.forEach(([nova, deQuem]) => {
    if (finais.has(deQuem)) finais.add(nova);
  });
  return Array.from(finais);
};

interface LinhaDeCargo {
  id: number;
  permissions: string | null;
}

interface LinhaDeUsuario {
  id: number;
  accessExceptions: string | null;
}

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    const cargos = await sequelize.query<LinhaDeCargo>(
      "SELECT id, permissions FROM Roles",
      { type: QueryTypes.SELECT }
    );

    for (const cargo of cargos) {
      const atuais = lerLista(cargo.permissions);
      if (!atuais) continue;

      const finais = acrescentar(atuais);
      if (finais.length === atuais.length) continue;

      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(
        "UPDATE Roles SET permissions = :permissions WHERE id = :id",
        {
          replacements: { id: cargo.id, permissions: JSON.stringify(finais) },
          type: QueryTypes.UPDATE
        }
      );
    }

    const usuarios = await sequelize.query<LinhaDeUsuario>(
      "SELECT id, accessExceptions FROM Users WHERE accessExceptions IS NOT NULL",
      { type: QueryTypes.SELECT }
    );

    for (const usuario of usuarios) {
      let excecoes: { allow?: string[]; add?: string[]; deny?: string[]; remove?: string[] };
      try {
        excecoes = JSON.parse(usuario.accessExceptions || "{}") ?? {};
      } catch {
        continue;
      }

      const chave = excecoes.allow ? "allow" : excecoes.add ? "add" : null;
      if (!chave) continue;

      const atuais = (excecoes as Record<string, string[]>)[chave].filter(
        p => typeof p === "string"
      );
      const finais = acrescentar(atuais);
      if (finais.length === atuais.length) continue;

      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(
        "UPDATE Users SET accessExceptions = :valor WHERE id = :id",
        {
          replacements: {
            id: usuario.id,
            valor: JSON.stringify({ ...excecoes, [chave]: finais })
          },
          type: QueryTypes.UPDATE
        }
      );
    }
  },

  /**
   * Desfazer remove as permissões novas de onde quer que estejam. As
   * permissões deixam de existir no catálogo ao voltar o código, e o
   * `sanitizar` as descartaria na primeira leitura de qualquer forma.
   */
  down: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    const cargos = await sequelize.query<LinhaDeCargo>(
      "SELECT id, permissions FROM Roles",
      { type: QueryTypes.SELECT }
    );

    for (const cargo of cargos) {
      const atuais = lerLista(cargo.permissions);
      if (!atuais) continue;

      const finais = atuais.filter(p => !NOVAS.has(p));
      if (finais.length === atuais.length) continue;

      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(
        "UPDATE Roles SET permissions = :permissions WHERE id = :id",
        {
          replacements: { id: cargo.id, permissions: JSON.stringify(finais) },
          type: QueryTypes.UPDATE
        }
      );
    }
  }
};
