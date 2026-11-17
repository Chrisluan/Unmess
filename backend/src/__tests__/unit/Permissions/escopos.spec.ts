import {
  alcanca,
  condicaoSql,
  escoposVazios,
  gravarEscoposDoCargo,
  gravarExcecoesDeEscopo,
  lerEscoposDoCargo,
  lerExcecoesDeEscopo,
  resolverDimensao,
  resolverEscopos
} from "../../../helpers/permissions/escopos";
import { garantirQuePodeConcederEscopos } from "../../../helpers/permissions/guards";
import { AcessoResolvido } from "../../../helpers/permissions/resolve";

const ator = (
  escopos: Record<string, { irrestrito?: boolean; ids?: number[]; negados?: number[] }>,
  isSuper = false
): AcessoResolvido => ({
  permissions: [],
  // `Object.fromEntries` não existe no target es6 do projeto.
  scopes: Object.entries(escopos).reduce(
    (acc, [chave, valor]) => ({
      ...acc,
      [chave]: {
        irrestrito: valor.irrestrito ?? false,
        ids: valor.ids ?? [],
        negados: valor.negados ?? []
      }
    }),
    escoposVazios()
  ),
  role: null,
  exceptions: { allow: [], deny: [] },
  scopeExceptions: {},
  isSuper
});

describe("Resolução de escopo", () => {
  it("cargo sem escopo não alcança nada", () => {
    const escopo = resolverDimensao(undefined, undefined);
    expect(escopo).toEqual({ irrestrito: false, ids: [], negados: [] });
    expect(alcanca(escopo, 1)).toBe(false);
  });

  it("cargo irrestrito alcança qualquer id, inclusive um que ainda não existe", () => {
    const escopo = resolverDimensao({ todos: true }, undefined);
    expect(alcanca(escopo, 1)).toBe(true);
    expect(alcanca(escopo, 999)).toBe(true);
  });

  it("a exceção da pessoa soma ao cargo", () => {
    const escopo = resolverDimensao({ ids: [1, 2] }, { allow: [5] });
    expect(escopo.ids).toEqual([1, 2, 5]);
  });

  it("bloquear vence liberar", () => {
    const escopo = resolverDimensao({ ids: [1, 2] }, { allow: [3], deny: [3] });
    expect(alcanca(escopo, 3)).toBe(false);
  });

  it("bloquear fura o irrestrito do cargo", () => {
    const escopo = resolverDimensao({ todos: true }, { deny: [7] });
    expect(escopo.irrestrito).toBe(true);
    expect(alcanca(escopo, 7)).toBe(false);
    expect(alcanca(escopo, 8)).toBe(true);
  });

  it("linha sem dimensão nenhuma continua visível", () => {
    // Um lançamento sem conta, um card sem quadro: não pertencem a escopo
    // algum, e escondê-los sumiria com eles da tela de todo mundo.
    const escopo = resolverDimensao({ ids: [1] }, undefined);
    expect(alcanca(escopo, null)).toBe(true);
    expect(alcanca(escopo, undefined)).toBe(true);
  });

  it("o super-admin alcança tudo sem cargo nenhum", () => {
    const escopos = resolverEscopos({
      isSuper: true,
      escoposDoCargo: {},
      excecoes: {}
    });
    expect(alcanca(escopos.board, 42)).toBe(true);
  });
});

describe("Leitura e gravação", () => {
  it("JSON estragado não concede nada", () => {
    expect(lerEscoposDoCargo("{ isso não é json")).toEqual({});
    expect(lerExcecoesDeEscopo("[]")).toEqual({});
  });

  it("descarta dimensão que não existe no catálogo", () => {
    const lido = lerEscoposDoCargo('{"board":{"ids":[1]},"inventado":{"ids":[2]}}');
    expect(Object.keys(lido)).toEqual(["board"]);
  });

  it("descarta id que não é inteiro positivo", () => {
    const lido = lerEscoposDoCargo('{"board":{"ids":[1,"2",0,-3,null,2.5]}}');
    expect(lido.board.ids).toEqual([1, 2]);
  });

  it("dimensão vazia não é gravada", () => {
    expect(gravarEscoposDoCargo({ board: { ids: [] } })).toBeNull();
    expect(gravarExcecoesDeEscopo({ board: { allow: [], deny: [] } })).toBeNull();
  });

  it("ida e volta preserva o que importa", () => {
    const gravado = gravarEscoposDoCargo({
      board: { todos: true },
      account: { ids: [3, 1] }
    });
    const lido = lerEscoposDoCargo(gravado);
    expect(lido.board.todos).toBe(true);
    expect(lido.account.ids).toEqual([1, 3]);
  });
});

describe("SQL gerado", () => {
  it("sem restrição não acrescenta cláusula", () => {
    expect(condicaoSql({ irrestrito: true, ids: [], negados: [] }, "d.boardId")).toBe(
      "1=1"
    );
  });

  it("lista vazia não vira IN () — que não é SQL válido", () => {
    const sql = condicaoSql({ irrestrito: false, ids: [], negados: [] }, "d.boardId");
    expect(sql).toBe("d.boardId IS NULL");
    expect(sql).not.toContain("IN ()");
  });

  it("irrestrito com bloqueio vira NOT IN", () => {
    expect(condicaoSql({ irrestrito: true, ids: [], negados: [4, 5] }, "d.boardId")).toBe(
      "(d.boardId IS NULL OR d.boardId NOT IN (4,5))"
    );
  });
});

describe("Ninguém dá alcance que não tem", () => {
  it("não se concede um quadro que não se alcança", () => {
    const quemConcede = ator({ board: { ids: [1, 2] } });

    expect(() =>
      garantirQuePodeConcederEscopos(quemConcede, {
        board: { irrestrito: false, ids: [1], negados: [] }
      })
    ).not.toThrow();

    expect(() =>
      garantirQuePodeConcederEscopos(quemConcede, {
        board: { irrestrito: false, ids: [1, 9], negados: [] }
      })
    ).toThrow();
  });

  it("irrestrito só se concede sendo irrestrito", () => {
    const restrito = ator({ board: { ids: [1] } });
    const irrestrito = ator({ board: { irrestrito: true } });
    const alvo = { board: { irrestrito: true, ids: [], negados: [] } };

    expect(() => garantirQuePodeConcederEscopos(restrito, alvo)).toThrow();
    expect(() => garantirQuePodeConcederEscopos(irrestrito, alvo)).not.toThrow();
  });

  it("irrestrito com um bloqueio não concede irrestrito", () => {
    // Quem é "todos menos o quadro 3" não pode conceder "todos", senão
    // atribui o cargo a um colega e volta a enxergar o 3 por tabela.
    const quaseIrrestrito = ator({ board: { irrestrito: true, negados: [3] } });

    expect(() =>
      garantirQuePodeConcederEscopos(quaseIrrestrito, {
        board: { irrestrito: true, ids: [], negados: [] }
      })
    ).toThrow();
  });

  it("o super-admin passa por cima", () => {
    expect(() =>
      garantirQuePodeConcederEscopos(ator({}, true), {
        board: { irrestrito: true, ids: [], negados: [] }
      })
    ).not.toThrow();
  });
});
