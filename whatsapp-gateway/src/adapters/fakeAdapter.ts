import { randomUUID } from "node:crypto";
import type { SendMessageCommand } from "../contract.ts";
import type { AdapterListener, WhatsappAdapter } from "./adapter.ts";

export interface FakeAdapterOptions {
  pairingDelayMs: number;
  statusDelayMs: number;
}

export class FakeAdapter implements WhatsappAdapter {
  private readonly options: FakeAdapterOptions;
  private readonly listeners = new Map<string, AdapterListener>();
  private readonly paired = new Set<string>();
  private readonly timers = new Set<NodeJS.Timeout>();

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
    const listener = this.listeners.get(sessionId);
    if (!listener || !this.paired.has(sessionId)) {
      throw new Error("session is not connected");
    }

    const messageId = `FAKE${randomUUID().replaceAll("-", "").toUpperCase()}`;
    const chatId = toChatId(command.to);
    const statuses = ["sent", "delivered", "read"] as const;
    statuses.forEach((status, index) => {
      this.later(this.options.statusDelayMs * (index + 1), () => listener.onStatus(sessionId, messageId, chatId, status));
    });
    return { messageId, chatId };
  }

  simulateInbound(sessionId: string, from: string, text: string, pushName?: string): string {
    const listener = this.listeners.get(sessionId);
    if (!listener || !this.paired.has(sessionId)) {
      throw new Error("session is not connected");
    }

    const chatId = toChatId(from);
    const id = `FAKEIN${randomUUID().replaceAll("-", "").toUpperCase()}`;
    listener.onMessage(sessionId, {
      id,
      chatId,
      from: chatId,
      fromMe: false,
      pushName,
      timestamp: Math.floor(Date.now() / 1000),
      kind: "text",
      text
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
  if (to.includes("@")) {
    return to;
  }
  return `${to.replace(/\D/g, "")}@s.whatsapp.net`;
}
