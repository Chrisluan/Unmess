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
