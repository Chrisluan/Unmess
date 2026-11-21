export type MessageType =
  | "chat"
  | "audio"
  | "ptt"
  | "video"
  | "image"
  | "document"
  | "vcard"
  | "sticker"
  | "location";

/**
 * Estado de uma mensagem própria, na escala usada pelo sistema inteiro
 * (banco, socket e tela):
 *
 *  -1  falhou — o WhatsApp recusou a mensagem
 *   0  enviando — saiu daqui, ainda sem confirmação do servidor
 *   1  enviada — o servidor do WhatsApp confirmou o recebimento
 *   2  entregue — chegou ao aparelho do contato
 *   3  lida
 *   4  ouvida (áudio)
 *
 * Não é a escala do Baileys, que numera os mesmos estados com um a mais e
 * reserva o 0 para erro. A conversão fica em um único ponto — `traduzirAck`,
 * na implementação do provedor — justamente para o resto do sistema poder
 * confiar nesta tabela.
 */
export type MessageAck = -1 | 0 | 1 | 2 | 3 | 4;

export interface ProviderMessage {
  id: string;
  body: string;
  fromMe: boolean;
  hasMedia: boolean;
  type: MessageType;
  timestamp: number;
  from: string;
  to: string;
  hasQuotedMsg?: boolean;
  ack?: MessageAck;
}
