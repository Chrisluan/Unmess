import { Op, WhereOptions } from "sequelize";

import {
  CHAVES_DE_ESCOPO,
  existeEscopo,
  sanitizarIds
} from "./catalog";

/**
 * Escopo — *sobre quais coisas* a permissão vale.
 *
 * A conta é a mesma das permissões, e de propósito:
 *
 *     escopo do cargo
 *   + itens liberados para a pessoa
 *   − itens bloqueados para a pessoa
 *
 * A diferença é o que está sendo somado: ali são ações de um catálogo fechado,
 * aqui são linhas de tabelas que a empresa cria e apaga o tempo todo. Por isso
 * existe o estado "irrestrito", que não tem equivalente nas permissões: um
 * cargo marcado como irrestrito acompanha os quadros criados amanhã sem que
 * ninguém precise voltar na tela e marcá-los.
 *
 * O padrão é negar. Cargo sem escopo definido não alcança nada, e é isso que
 * torna "esquecer de configurar" um erro visível — a pessoa abre o CRM e não
 * vê quadro nenhum — em vez de um vazamento silencioso.
 */

/** Como o cargo declara o escopo de uma dimensão. */
export interface EscopoDoCargo {
  /** Acompanha tudo que existir, inclusive o que for criado depois. */
  todos?: boolean;
  ids?: number[];
}

/** As exceções individuais, por cima do cargo. */
export interface ExcecaoDeEscopo {
  allow?: number[];
  deny?: number[];
}

/**
 * O escopo já resolvido, do jeito que a consulta precisa dele.
 *
 * `irrestrito` com `negados` vazio é o caso em que nenhuma cláusula entra no
 * SQL — importante, porque é o caso da maioria das pessoas e não faz sentido
 * pagar um `IN` com trezentos ids por ele.
 */
export interface EscopoResolvido {
  irrestrito: boolean;
  ids: number[];
  negados: number[];
}

export type EscoposResolvidos = Record<string, EscopoResolvido>;

const IRRESTRITO: EscopoResolvido = { irrestrito: true, ids: [], negados: [] };

const NENHUM: EscopoResolvido = { irrestrito: false, ids: [], negados: [] };

/**
 * Nunca lança: escopo corrompido no banco não pode derrubar a requisição.
 *
 * Ao contrário da leitura de permissões, aqui o lado seguro do erro também é
 * negar — um JSON estragado vira "não alcança nada", e a pessoa descobre isso
 * abrindo a tela vazia, não descobrindo dados que não deveria ver.
 */
const lerJson = (cru: string | null): Record<string, unknown> => {
  if (!cru) return {};
  try {
    const valor = JSON.parse(cru);
    return valor && typeof valor === "object" && !Array.isArray(valor)
      ? valor
      : {};
  } catch {
    return {};
  }
};

export const lerEscoposDoCargo = (
  cru: string | null
): Record<string, EscopoDoCargo> => {
  const bruto = lerJson(cru);
  const saida: Record<string, EscopoDoCargo> = {};

  CHAVES_DE_ESCOPO.forEach(chave => {
    const item = bruto[chave] as Record<string, unknown> | undefined;
    if (!item || typeof item !== "object") return;
    saida[chave] = {
      todos: item.todos === true,
      ids: sanitizarIds(item.ids)
    };
  });

  return saida;
};

export const lerExcecoesDeEscopo = (
  cru: string | null
): Record<string, ExcecaoDeEscopo> => {
  const bruto = lerJson(cru);
  const saida: Record<string, ExcecaoDeEscopo> = {};

  CHAVES_DE_ESCOPO.forEach(chave => {
    const item = bruto[chave] as Record<string, unknown> | undefined;
    if (!item || typeof item !== "object") return;
    saida[chave] = {
      allow: sanitizarIds(item.allow),
      deny: sanitizarIds(item.deny)
    };
  });

  return saida;
};

/**
 * Grava de volta, omitindo o que está vazio.
 *
 * Uma dimensão sem nada marcado não vira `{"todos":false,"ids":[]}` no banco:
 * ela simplesmente não aparece. O resultado é o mesmo na leitura, e a coluna
 * continua legível para quem for depurar com o olho.
 */
export const gravarEscoposDoCargo = (
  escopos: Record<string, EscopoDoCargo>
): string | null => {
  const saida: Record<string, EscopoDoCargo> = {};

  CHAVES_DE_ESCOPO.forEach(chave => {
    const item = escopos[chave];
    if (!item) return;
    if (item.todos) {
      saida[chave] = { todos: true };
      return;
    }
    const ids = sanitizarIds(item.ids);
    if (ids.length > 0) saida[chave] = { ids };
  });

  return Object.keys(saida).length === 0 ? null : JSON.stringify(saida);
};

export const gravarExcecoesDeEscopo = (
  excecoes: Record<string, ExcecaoDeEscopo>
): string | null => {
  const saida: Record<string, ExcecaoDeEscopo> = {};

  CHAVES_DE_ESCOPO.forEach(chave => {
    const item = excecoes[chave];
    if (!item) return;
    const allow = sanitizarIds(item.allow);
    const deny = sanitizarIds(item.deny);
    if (allow.length > 0 || deny.length > 0) {
      saida[chave] = {
        ...(allow.length > 0 ? { allow } : {}),
        ...(deny.length > 0 ? { deny } : {})
      };
    }
  });

  return Object.keys(saida).length === 0 ? null : JSON.stringify(saida);
};

/**
 * Aplica a conta de cima a uma dimensão.
 *
 * Separada da consulta ao banco pelo mesmo motivo que `aplicarExcecoes`: a
 * tela precisa mostrar "o que esta pessoa passaria a enxergar" antes de
 * salvar, e uma prévia que use regra diferente da real não serve para nada.
 *
 * Bloquear vence liberar. Se o mesmo id aparecer nos dois lados — o que só
 * acontece por engano de quem preencheu —, ele fica de fora: entre as duas
 * leituras possíveis de uma configuração contraditória, a que nega é a que não
 * causa estrago.
 */
export const resolverDimensao = (
  doCargo: EscopoDoCargo | undefined,
  excecao: ExcecaoDeEscopo | undefined
): EscopoResolvido => {
  const allow = sanitizarIds(excecao?.allow);
  const deny = sanitizarIds(excecao?.deny);

  if (doCargo?.todos) {
    return { irrestrito: true, ids: [], negados: deny };
  }

  const base = new Set([...(doCargo?.ids ?? []), ...allow]);
  deny.forEach(id => base.delete(id));

  return {
    irrestrito: false,
    ids: Array.from(base).sort((a, b) => a - b),
    negados: deny
  };
};

/**
 * Resolve todas as dimensões de uma vez.
 *
 * `isSuper` curto-circuita tudo: o super-admin é o dono do servidor, não um
 * usuário da empresa, e responde pelo mesmo caminho que já responde nas
 * permissões.
 */
export const resolverEscopos = ({
  isSuper,
  escoposDoCargo,
  excecoes
}: {
  isSuper: boolean;
  escoposDoCargo: Record<string, EscopoDoCargo>;
  excecoes: Record<string, ExcecaoDeEscopo>;
}): EscoposResolvidos => {
  const saida: EscoposResolvidos = {};

  CHAVES_DE_ESCOPO.forEach(chave => {
    saida[chave] = isSuper
      ? IRRESTRITO
      : resolverDimensao(escoposDoCargo[chave], excecoes[chave]);
  });

  return saida;
};

/** O que sobra quando não há usuário nenhum: nada. */
export const escoposVazios = (): EscoposResolvidos => {
  const saida: EscoposResolvidos = {};
  CHAVES_DE_ESCOPO.forEach(chave => {
    saida[chave] = NENHUM;
  });
  return saida;
};

// ── Uso nas consultas ───────────────────────────────────────────────────────

/**
 * Esta linha está dentro do escopo?
 *
 * Para conferir uma coisa só — o quadro para onde o card está sendo movido, a
 * conta escolhida na baixa. Listagens usam `filtroDeEscopo`.
 *
 * `null` passa de propósito: um lançamento sem conta, um card sem quadro, não
 * pertencem a escopo nenhum e não podem ser escondidos por um filtro de
 * escopo — sumiriam da tela de todo mundo, inclusive de quem é irrestrito.
 */
export const alcanca = (
  escopo: EscopoResolvido | undefined,
  id: number | null | undefined
): boolean => {
  if (!escopo) return false;
  if (id === null || id === undefined) return true;
  if (escopo.negados.includes(id)) return false;
  return escopo.irrestrito || escopo.ids.includes(id);
};

/**
 * O fragmento de `where` para uma coluna, ou `undefined` quando não há
 * restrição nenhuma a impor.
 *
 * Devolver `undefined` em vez de um objeto vazio importa: é o que permite
 * espalhar o resultado dentro de um where existente sem acrescentar cláusula
 * alguma no caso comum.
 *
 * O `[Op.or]` com `null` acompanha a regra de `alcanca`: linha sem a coluna
 * preenchida não pertence a escopo nenhum, e continua visível. É o mesmo
 * desenho que a filtragem de conversas por fila já usa.
 */
export const filtroDeEscopo = (
  escopo: EscopoResolvido | undefined,
  coluna: string
): WhereOptions | undefined => {
  if (!escopo) return { [coluna]: null } as WhereOptions;

  if (escopo.irrestrito) {
    if (escopo.negados.length === 0) return undefined;
    return {
      [coluna]: { [Op.or]: [{ [Op.notIn]: escopo.negados }, null] }
    } as WhereOptions;
  }

  return {
    [coluna]: { [Op.or]: [{ [Op.in]: escopo.ids }, null] }
  } as WhereOptions;
};

/**
 * O mesmo filtro, em SQL cru, para os serviços que agregam à mão.
 *
 * Devolve `"1=1"` quando não há restrição — sempre uma expressão booleana
 * válida, para quem monta a consulta poder interpolar sem `if`. Os ids já
 * passaram por `sanitizarIds` e são inteiros: não há string chegando aqui.
 */
export const condicaoSql = (
  escopo: EscopoResolvido | undefined,
  coluna: string
): string => {
  if (!escopo) return `${coluna} IS NULL`;

  if (escopo.irrestrito) {
    if (escopo.negados.length === 0) return "1=1";
    return `(${coluna} IS NULL OR ${coluna} NOT IN (${escopo.negados.join(",")}))`;
  }

  if (escopo.ids.length === 0) return `${coluna} IS NULL`;

  return `(${coluna} IS NULL OR ${coluna} IN (${escopo.ids.join(",")}))`;
};

export { existeEscopo };
