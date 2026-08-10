/**
 * Avalia a regra de aba recebida do backend contra um ticket.
 *
 * A definição das abas mora em backend/src/helpers/TicketTabRules.ts e chega
 * aqui pela API. Este arquivo apenas interpreta — não decide. Antes a regra
 * era reescrita à mão dos dois lados, e quando divergiram o ticket aparecia ao
 * recarregar a página mas nunca pelo socket.
 */
export const matchesTabRule = (rule, ticket, { userId, queueIds }) => {
  if (!rule || !ticket) return false;

  const status = Array.isArray(rule.status) ? rule.status : [rule.status];
  if (!status.includes(ticket.status)) return false;

  // Comparação frouxa de propósito: o id do usuário vem como número da API e
  // como string em algumas rotas.
  const mesmoUsuario = String(ticket.userId) === String(userId);

  if (rule.userId === "me" && !mesmoUsuario) return false;
  if (rule.userId === "none" && ticket.userId) return false;
  if (rule.userId === "other" && (!ticket.userId || mesmoUsuario)) return false;

  if (rule.queueId === "mine") {
    if (!ticket.queueId || queueIds.indexOf(ticket.queueId) === -1) return false;
  }

  if (rule.queueId === "mineOrNone") {
    if (ticket.queueId && queueIds.indexOf(ticket.queueId) === -1) return false;
  }

  if (rule.isGroup !== undefined && Boolean(ticket.isGroup) !== rule.isGroup) {
    return false;
  }

  // Regra sobre o contato, não sobre o ticket: separa conversas de pessoas
  // conhecidas da fila de oportunidades.
  if (
    rule.contactIsKnown !== undefined &&
    Boolean(ticket.contact?.isKnown) !== rule.contactIsKnown
  ) {
    return false;
  }

  return true;
};

export default matchesTabRule;
