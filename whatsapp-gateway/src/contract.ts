export const CONTRACT_VERSION = "v1";

export type SessionStatus = "disconnected" | "connecting" | "qr" | "connected" | "needs_qr";

export type MessageKind = "text" | "image" | "video" | "audio" | "voice" | "document" | "sticker" | "location" | "contact" | "unknown";

export type DeliveryStatus = "pending" | "sent" | "delivered" | "read" | "played" | "failed";

export interface MediaReference {
  ref: string;
  mimetype: string;
  filename?: string;
}

export interface InboundMessage {
  id: string;
  chatId: string;
  from: string;
  fromMe: boolean;
  pushName?: string;
  timestamp: number;
  kind: MessageKind;
  text?: string;
  media?: MediaReference;
  quotedMessageId?: string;
}

export type GatewayEvent =
  | { type: "message.received"; sessionId: string; message: InboundMessage }
  | { type: "message.status"; sessionId: string; messageId: string; chatId: string; status: DeliveryStatus }
  | { type: "connection.update"; sessionId: string; status: SessionStatus; phoneNumber?: string; reason?: string }
  | { type: "qr"; sessionId: string; qr: string };

export interface EventEnvelope {
  id: string;
  version: typeof CONTRACT_VERSION;
  occurredAt: string;
  event: GatewayEvent;
}

export interface SendMessageCommand {
  to: string;
  text?: string;
  media?: MediaReference & { caption?: string; asVoice?: boolean; asDocument?: boolean; asSticker?: boolean };
  quotedMessageId?: string;
}

export interface SessionSnapshot {
  sessionId: string;
  status: SessionStatus;
  phoneNumber?: string;
  qr?: string;
  lastError?: string;
  updatedAt: string;
}
