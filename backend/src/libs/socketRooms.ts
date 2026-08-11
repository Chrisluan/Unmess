/**
 * Nomes das salas do Socket.io, sempre com o id da empresa.
 *
 * As salas "notification", "open", "pending" e "closed" eram globais: qualquer
 * usuário logado entrava nelas e recebia os eventos de TODAS as empresas,
 * incluindo o conteúdo das mensagens. Centralizar a formação do nome aqui
 * evita que um ponto de emissão volte a esquecer o escopo.
 */

export const companyRoom = (companyId: number | string): string =>
  `company-${companyId}`;

export const notificationRoom = (companyId: number | string): string =>
  `company-${companyId}-notification`;

/** Sala por status de ticket (open, pending, closed). */
export const statusRoom = (
  companyId: number | string,
  status: string
): string => `company-${companyId}-status-${status}`;

/**
 * Sala de uma conversa. O id do ticket já é único entre empresas, mas o
 * escopo impede que alguém entre na conversa de outra empresa chutando o id.
 */
export const ticketRoom = (
  companyId: number | string,
  ticketId: number | string
): string => `company-${companyId}-ticket-${ticketId}`;
