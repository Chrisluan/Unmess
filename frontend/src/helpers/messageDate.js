/**
 * Horário a exibir para uma mensagem.
 *
 * `timestamp` é a hora real de envio informada pelo WhatsApp; `createdAt` é
 * quando o backend gravou a linha. Os dois divergem quando a mensagem demora a
 * chegar — retentativa de decriptação, sessão reconectando — e nesses casos só
 * o primeiro corresponde ao que o cliente vê no celular.
 *
 * Mensagens gravadas antes da coluna existir não têm `timestamp` e caem em
 * `createdAt`.
 */
export const messageDate = message => message?.timestamp || message?.createdAt;

export default messageDate;

/**
 * Horário da última mensagem de um atendimento, para a lista.
 *
 * `lastMessageAt` vem do WhatsApp — a mesma fonte usada dentro da conversa,
 * então os dois lugares mostram o mesmo horário. `updatedAt` é o relógio do
 * servidor e muda a cada alteração do ticket (atribuir atendente, trocar
 * setor), o que reiniciaria o contador de espera sem mensagem nova.
 */
export const ticketDate = ticket => ticket?.lastMessageAt || ticket?.updatedAt;
