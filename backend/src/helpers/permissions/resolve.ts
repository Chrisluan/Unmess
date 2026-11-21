import User from "../../models/User";
import Role from "../../models/Role";
import {
  ALL_PERMISSIONS,
  comDependencias,
  ordenar,
  sanitizar,
  semDependentes,
  Permission
} from "./catalog";
import {
  EscoposResolvidos,
  ExcecaoDeEscopo,
  escoposVazios,
  lerEscoposDoCargo,
  lerExcecoesDeEscopo,
  resolverEscopos
} from "./escopos";

/**
 * Resolve o que uma pessoa pode fazer.
 *
 * A conta é sempre esta, nesta ordem:
 *
 *     permissões do cargo
 *   + exceções liberadas para a pessoa
 *   − exceções bloqueadas para a pessoa
 *
 * Quem não tem cargo não pode nada. Não existe mais atalho no código que
 * libere tudo por causa do valor de um campo de texto: o Administrador é um
 * cargo de verdade, com dono, nome e empresa, e o único privilégio dele é
 * receber o catálogo inteiro em tempo de execução em vez de uma lista
 * congelada no banco.
 *
 * O super-admin da plataforma continua passando por cima de tudo — ele é o
 * dono do servidor, não um usuário da empresa —, mas só depois de escolher
 * uma empresa para operar.
 */

export interface ExcecoesDeAcesso {
  allow: Permission[];
  deny: Permission[];
}

export interface AcessoResolvido {
  /** O que vale no fim das contas. É isto que as rotas conferem. */
  permissions: Permission[];
  /**
   * Sobre quais coisas essas permissões valem — quadros, contas, conexões.
   *
   * Vem junto de propósito, e não de uma segunda consulta: quem já perguntou
   * "pode ver o CRM?" quase sempre pergunta em seguida "quais quadros?", e
   * separar as duas leituras dobraria o custo de toda listagem para poupar
   * dois campos de JSON na mesma linha que já foi buscada.
   */
  scopes: EscoposResolvidos;
  role: {
    id: number;
    name: string;
    isSystem: boolean;
    permissions: Permission[];
  } | null;
  exceptions: ExcecoesDeAcesso;
  /** As exceções de escopo, cruas, para a tela poder editá-las. */
  scopeExceptions: Record<string, ExcecaoDeEscopo>;
  isSuper: boolean;
}

const SEM_ACESSO: AcessoResolvido = {
  permissions: [],
  scopes: escoposVazios(),
  role: null,
  exceptions: { allow: [], deny: [] },
  scopeExceptions: {},
  isSuper: false
};

export const ehSuper = (profile: string | null | undefined): boolean =>
  profile === "super";

/**
 * Lê as exceções individuais gravadas no usuário.
 *
 * Aceita também o formato antigo `{add, remove}`, para o caso de alguma linha
 * ter escapado da migração. Qualquer coisa que não seja lista de permissão
 * conhecida é descartada em silêncio — o lado seguro de um JSON estragado é
 * não conceder nada, nunca conceder tudo.
 */
export const lerExcecoes = (cru: string | null): ExcecoesDeAcesso => {
  if (!cru) return { allow: [], deny: [] };
  try {
    const bruto = JSON.parse(cru) ?? {};
    return {
      allow: sanitizar(bruto.allow ?? bruto.add),
      deny: sanitizar(bruto.deny ?? bruto.remove)
    };
  } catch (err) {
    return { allow: [], deny: [] };
  }
};

export const gravarExcecoes = (excecoes: ExcecoesDeAcesso): string | null => {
  const allow = sanitizar(excecoes.allow);
  const deny = sanitizar(excecoes.deny);
  if (allow.length === 0 && deny.length === 0) return null;
  return JSON.stringify({ allow, deny });
};

/**
 * Aplica a conta acima a um cargo e um conjunto de exceções.
 *
 * Separada da consulta ao banco de propósito: a tela de cargos precisa
 * pré-visualizar "o que esta pessoa passaria a enxergar" antes de salvar, e
 * uma prévia que use uma regra diferente da real não serve para nada.
 */
export const aplicarExcecoes = (
  permissoesDoCargo: Permission[],
  excecoes: ExcecoesDeAcesso
): Permission[] => {
  // Liberar uma ação libera junto o que ela precisa para funcionar. Sem isso,
  // "liberar excluir conversa" para uma pessoa sem acesso a conversas produz
  // uma permissão que não faz nada.
  let resultado = comDependencias([...permissoesDoCargo, ...excecoes.allow]);

  // Bloquear derruba junto tudo que dependia do que foi bloqueado: tirar
  // "ver conversas" e deixar "excluir conversa" de pé seria uma brecha
  // esperando uma rota que confie só na segunda.
  excecoes.deny.forEach(bloqueada => {
    resultado = semDependentes(resultado, bloqueada);
  });

  return ordenar(resultado);
};

/**
 * Consulta o acesso de um usuário no banco.
 *
 * A leitura é feita a cada requisição, e não gravada no token. É o que faz
 * "tirar a permissão de alguém" valer agora, e não no próximo login: um token
 * assinado com a lista dentro continuaria valendo até expirar, com as
 * permissões do dia em que foi emitido.
 */
export const resolverAcessoDoUsuario = async (
  userId: number
): Promise<AcessoResolvido> => {
  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: "role" }]
  });

  if (!user) return SEM_ACESSO;

  if (ehSuper(user.profile)) {
    return {
      permissions: [...ALL_PERMISSIONS],
      scopes: resolverEscopos({
        isSuper: true,
        escoposDoCargo: {},
        excecoes: {}
      }),
      role: null,
      exceptions: { allow: [], deny: [] },
      scopeExceptions: {},
      isSuper: true
    };
  }

  const permissoesDoCargo = user.role ? user.role.permissionsList : [];
  const exceptions = lerExcecoes(user.accessExceptions);
  const scopeExceptions = lerExcecoesDeEscopo(user.scopeExceptions);

  return {
    permissions: aplicarExcecoes(permissoesDoCargo, exceptions),
    scopes: resolverEscopos({
      isSuper: false,
      // Sem cargo não há escopo, do mesmo jeito que não há permissão. As duas
      // metades da resposta vêm da mesma linha, e é por isso que este arquivo
      // resolve as duas de uma vez.
      escoposDoCargo: user.role
        ? user.role.scopesMap
        : lerEscoposDoCargo(null),
      excecoes: scopeExceptions
    }),
    role: user.role
      ? {
          id: user.role.id,
          name: user.role.name,
          isSystem: user.role.isSystem,
          permissions: permissoesDoCargo
        }
      : null,
    exceptions,
    scopeExceptions,
    isSuper: false
  };
};

export const permissoesDoUsuario = async (
  userId: number
): Promise<Permission[]> => {
  const { permissions } = await resolverAcessoDoUsuario(userId);
  return permissions;
};

export const usuarioPode = async (
  userId: number,
  permissao: Permission
): Promise<boolean> => {
  const permissions = await permissoesDoUsuario(userId);
  return permissions.includes(permissao);
};

/**
 * Os escopos de uma pessoa, para quem só precisa deles.
 *
 * Mesma leitura de `resolverAcessoDoUsuario` — o atalho existe para a
 * chamada ficar legível na listagem, não para economizar consulta.
 */
export const escoposDoUsuario = async (
  userId: number
): Promise<EscoposResolvidos> => {
  const { scopes } = await resolverAcessoDoUsuario(userId);
  return scopes;
};
