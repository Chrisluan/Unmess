import { Op, Filterable } from "sequelize";

/**
 * Definição única das abas do painel de atendimento.
 *
 * A regra vivia escrita duas vezes — como cláusula SQL no ListTicketsService e
 * como predicado JavaScript no TicketsList do frontend. Nada obrigava as duas
 * a concordarem, e quando divergiram o ticket aparecia ao recarregar a página
 * (vinha da API) mas nunca pelo socket.
 *
 * Aqui a aba é descrita em termos declarativos. O backend traduz para SQL e o
 * frontend recebe este mesmo objeto pela API e o interpreta. Mudar uma aba
 * passa a ser mudar um lugar só.
 */

/** A quem o ticket precisa estar atribuído. */
export type RegraAtendente = "me" | "none" | "other";

/** Em que setor o ticket precisa estar, relativo aos setores do usuário. */
export type RegraSetor = "mine" | "mineOrNone";

export interface TabRule {
  status: string | string[];
  userId?: RegraAtendente;
  queueId?: RegraSetor;
  isGroup?: boolean;
}

export const TAB_RULES: Record<string, TabRule> = {
  // Abertos atribuídos a mim, em qualquer setor.
  myTickets: {
    status: "open",
    userId: "me"
  },
  // Abertos com atendente, nos meus setores, mas de outra pessoa — para não
  // duplicar o que já aparece em myTickets.
  attending: {
    status: "open",
    userId: "other",
    queueId: "mine"
  },
  // Pendentes sem atendente, nos meus setores ou ainda sem setor.
  waiting: {
    status: "pending",
    userId: "none",
    queueId: "mineOrNone"
  },
  // Grupos ativos da empresa, com ou sem atendente: atribuir grupo a um
  // atendente específico raramente faz sentido no dia a dia.
  groups: {
    status: ["open", "pending"],
    isGroup: true
  }
};

interface Contexto {
  companyId: number;
  userId: string | number;
  queueIds: number[];
}

/** Traduz a regra da aba para a cláusula where do Sequelize. */
export const buildTabWhere = (
  tab: string,
  { companyId, userId, queueIds }: Contexto
): Filterable["where"] | null => {
  const rule = TAB_RULES[tab];
  if (!rule) return null;

  const where: Record<string, unknown> = { companyId };

  where.status = Array.isArray(rule.status)
    ? { [Op.in]: rule.status }
    : rule.status;

  if (rule.userId === "me") where.userId = userId;
  if (rule.userId === "none") where.userId = null;
  if (rule.userId === "other") {
    where.userId = {
      [Op.and]: [{ [Op.ne]: userId }, { [Op.not]: null }]
    };
  }

  if (rule.queueId === "mine") where.queueId = { [Op.or]: [queueIds] };
  if (rule.queueId === "mineOrNone") {
    where.queueId = { [Op.or]: [queueIds, null] };
  }

  if (rule.isGroup !== undefined) where.isGroup = rule.isGroup;

  return where as Filterable["where"];
};

export default TAB_RULES;
