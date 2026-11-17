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

export interface NumberCheck {
  exists: boolean;
  jid?: string;
}

export interface PhoneContact {
  jid: string;
  number: string;
  name?: string;
  pushName?: string;
}

export interface WhatsappAdapter {
  connect(sessionId: string, listener: AdapterListener): Promise<void>;
  disconnect(sessionId: string, logout: boolean): Promise<void>;
  send(sessionId: string, command: SendMessageCommand): Promise<{ messageId: string; chatId: string }>;
  checkNumber(sessionId: string, number: string): Promise<NumberCheck>;
  profilePictureUrl(sessionId: string, jid: string): Promise<string | undefined>;
  contacts(sessionId: string): Promise<PhoneContact[]>;
  shutdown(): Promise<void>;
}

export class SessionUnavailableError extends Error {}
