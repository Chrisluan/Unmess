export interface SendMessageOptions {
  quotedMessageId?: string;
  quotedMessageFromMe?: boolean;
  linkPreview?: boolean;
}

export interface SendMediaOptions {
  caption?: string;
  sendAudioAsVoice?: boolean;
  sendMediaAsDocument?: boolean;
  quotedMessageId?: string;
  /**
   * Envia como figurinha em vez de imagem.
   *
   * Precisa ser dito explicitamente porque o arquivo é o mesmo -- um WebP --, e
   * só o tipo do envio decide se o WhatsApp mostra uma figurinha sem balão ou
   * uma imagem comum dentro de um.
   */
  asSticker?: boolean;
}
