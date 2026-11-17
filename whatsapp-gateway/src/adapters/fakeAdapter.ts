import { randomUUID } from "node:crypto";
import type { DeleteMessageCommand, EditMessageCommand, ReadMessagesCommand, SendMessageCommand } from "../contract.ts";
import { SessionUnavailableError, type AdapterListener, type NumberCheck, type PhoneContact, type WhatsappAdapter } from "./adapter.ts";

export interface FakeAdapterOptions {
  pairingDelayMs: number;
  statusDelayMs: number;
}

export interface FakeInbound {
  from: string;
  text: string;
  pushName?: string;
  groupId?: string;
  groupName?: string;
}

export class FakeAdapter implements WhatsappAdapter {
  private readonly options: FakeAdapterOptions;
  private readonly listeners = new Map<string, AdapterListener>();
  private readonly paired = new Set<string>();
  private readonly timers = new Set<NodeJS.Timeout>();
  readonly sent: { sessionId: string; command: SendMessageCommand; messageId: string }[] = [];
  readonly reads: { sessionId: string; command: ReadMessagesCommand }[] = [];

  constructor(options: FakeAdapterOptions = { pairingDelayMs: 1500, statusDelayMs: 500 }) {
    this.options = options;
  }

  async connect(sessionId: string, listener: AdapterListener): Promise<void> {
    this.listeners.set(sessionId, listener);
    listener.onConnection(sessionId, { state: "connecting" });

    if (this.paired.has(sessionId)) {
      listener.onConnection(sessionId, { state: "open", phoneNumber: this.phoneFor(sessionId) });
      return;
    }

    listener.onConnection(sessionId, { state: "qr", qr: `FAKE-QR:${sessionId}:${randomUUID()}` });
    this.later(this.options.pairingDelayMs, () => {
      if (!this.listeners.has(sessionId)) {
        return;
      }
      this.paired.add(sessionId);
      listener.onConnection(sessionId, { state: "open", phoneNumber: this.phoneFor(sessionId) });
    });
  }

  async disconnect(sessionId: string, logout: boolean): Promise<void> {
    const listener = this.listeners.get(sessionId);
    this.listeners.delete(sessionId);
    if (logout) {
      this.paired.delete(sessionId);
    }
    listener?.onConnection(sessionId, { state: "closed", reason: logout ? "logged_out" : "disconnected", loggedOut: logout });
  }

  async send(sessionId: string, command: SendMessageCommand): Promise<{ messageId: string; chatId: string }> {
    const listener = this.requireConnected(sessionId);
    const messageId = `FAKE${randomUUID().replaceAll("-", "").toUpperCase()}`;
    const chatId = toChatId(command.to);
    this.sent.push({ sessionId, command, messageId });
    const statuses = ["sent", "delivered", "read"] as const;
    statuses.forEach((status, index) => {
      this.later(this.options.statusDelayMs * (index + 1), () => listener.onStatus(sessionId, messageId, chatId, status));
    });
    return { messageId, chatId };
  }

  async editMessage(sessionId: string, _messageId: string, _command: EditMessageCommand): Promise<void> {
    this.requireConnected(sessionId);
  }

  async deleteMessage(sessionId: string, _messageId: string, _command: DeleteMessageCommand): Promise<void> {
    this.requireConnected(sessionId);
  }

  async markRead(sessionId: string, command: ReadMessagesCommand): Promise<void> {
    this.requireConnected(sessionId);
    this.reads.push({ sessionId, command });
  }

  async checkNumber(sessionId: string, number: string): Promise<NumberCheck> {
    this.requireConnected(sessionId);
    const digits = number.replace(/\D/g, "");
    return digits.length >= 10 ? { exists: true, jid: `${digits}@s.whatsapp.net` } : { exists: false };
  }

  async profilePictureUrl(sessionId: string): Promise<string | undefined> {
    this.requireConnected(sessionId);
    return undefined;
  }

  async contacts(sessionId: string): Promise<PhoneContact[]> {
    this.requireConnected(sessionId);
    return [
      { jid: "5585900000001@s.whatsapp.net", number: "5585900000001", name: "Cliente Simulado 1" },
      { jid: "5585900000002@s.whatsapp.net", number: "5585900000002", pushName: "Cliente Simulado 2" }
    ];
  }

  simulateInbound(sessionId: string, inbound: FakeInbound): string {
    const listener = this.requireConnected(sessionId);
    const senderJid = toChatId(inbound.from);
    const number = senderJid.split("@")[0] ?? senderJid;
    const groupJid = inbound.groupId ? `${inbound.groupId.replace(/\D/g, "")}@g.us` : undefined;
    const id = `FAKEIN${randomUUID().replaceAll("-", "").toUpperCase()}`;
    listener.onMessage(sessionId, {
      id,
      chatId: groupJid ?? senderJid,
      from: senderJid,
      fromMe: false,
      fromApp: false,
      isGroup: groupJid !== undefined,
      pushName: inbound.pushName,
      timestamp: Math.floor(Date.now() / 1000),
      kind: "text",
      text: inbound.text,
      sender: { jid: senderJid, number, name: inbound.pushName || number },
      group: groupJid ? { jid: groupJid, number: groupJid.split("@")[0] ?? groupJid, name: inbound.groupName || "Grupo Simulado" } : undefined
    });
    return id;
  }

  async shutdown(): Promise<void> {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.listeners.clear();
  }

  private requireConnected(sessionId: string): AdapterListener {
    const listener = this.listeners.get(sessionId);
    if (!listener || !this.paired.has(sessionId)) {
      throw new SessionUnavailableError("session is not connected");
    }
    return listener;
  }

  private later(delayMs: number, work: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      work();
    }, delayMs);
    this.timers.add(timer);
  }

  private phoneFor(sessionId: string): string {
    const digits = [...sessionId].reduce((sum, char) => sum + char.charCodeAt(0), 0).toString().padStart(4, "0");
    return `55000000${digits.slice(-4)}`;
  }
}

export function toChatId(to: string): string {
  if (to.endsWith("@c.us")) {
    return `${to.slice(0, -"@c.us".length)}@s.whatsapp.net`;
  }
  if (to.includes("@")) {
    return to;
  }
  return `${to.replace(/\D/g, "")}@s.whatsapp.net`;
}
