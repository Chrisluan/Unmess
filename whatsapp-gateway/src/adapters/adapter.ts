import type { DeliveryStatus, InboundMessage, SendMessageCommand } from "../contract.ts";

export type ConnectionState =
  | { state: "connecting" }
  | { state: "qr"; qr: string }
  | { state: "open"; phoneNumber?: string }
  | { state: "closed"; reason: string; loggedOut: boolean };

export interface AdapterListener {
  onConnection(sessionId: string, update: ConnectionState): void;
  onMessage(sessionId: string, message: InboundMessage): void;
  onStatus(sessionId: string, messageId: string, chatId: string, status: DeliveryStatus): void;
}

export interface WhatsappAdapter {
  connect(sessionId: string, listener: AdapterListener): Promise<void>;
  disconnect(sessionId: string, logout: boolean): Promise<void>;
  send(sessionId: string, command: SendMessageCommand): Promise<{ messageId: string; chatId: string }>;
  shutdown(): Promise<void>;
}
