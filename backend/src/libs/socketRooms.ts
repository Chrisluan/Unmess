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

/**
 * Quem pode ver dinheiro do funil (`crm:viewValues`) e quem não pode ficam em
 * salas diferentes. O evento de card é emitido duas vezes — completo para uma,
 * sem os valores para a outra —, porque uma emissão só para a empresa inteira
 * entregaria os números a quem a API já os esconde. Todo socket está em
 * exatamente uma das duas.
 */
export const salaComValores = (companyId: number | string): string =>
  `company-${companyId}-com-valores`;

export const salaSemValores = (companyId: number | string): string =>
  `company-${companyId}-sem-valores`;

/**
 * Sala de uma pessoa, com todas as abas dela. É por onde chega o que é só
 * dela — a mensagem de uma conversa a dois, por exemplo —, sem passar pela
 * sala da empresa inteira.
 */
export const userRoom = (
  companyId: number | string,
  userId: number | string
): string => `company-${companyId}-user-${userId}`;

/**
 * Sala de escuta do rádio de um canal. Só quem entrou no rádio recebe o
 * áudio: estar na empresa não é estar ouvindo.
 */
export const radioRoom = (
  companyId: number | string,
  channelId: number | string
): string => `company-${companyId}-radio-${channelId}`;
