import type {
  DeleteMessageCommand,
  EditMessageCommand,
  ReadMessagesCommand,
  SendMessageCommand,
  SessionSnapshot,
  SessionStatus
} from "./contract.ts";
import type { AdapterListener, ConnectionState, NumberCheck, PhoneContact, WhatsappAdapter } from "./adapters/adapter.ts";
import type { Logger } from "./logger.ts";
import type { Outbox } from "./outbox.ts";
import type { PacedQueue } from "./sendQueue.ts";
import type { SessionRepository } from "./storage/sessionRepository.ts";

export interface SessionMetrics {
  sent: number;
  sendFailures: number;
  received: number;
  reconnects: number;
}

export class SessionNotConnectedError extends Error {}

export class SessionManager implements AdapterListener {
  private readonly adapter: WhatsappAdapter;
  private readonly sessions: SessionRepository;
  private readonly outbox: Outbox;
  private readonly queue: PacedQueue;
  private readonly logger: Logger;
  private readonly qrCodes = new Map<string, string>();
  private readonly retries = new Map<string, number>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly metrics = new Map<string, SessionMetrics>();
  private stopping = false;

  constructor(adapter: WhatsappAdapter, sessions: SessionRepository, outbox: Outbox, queue: PacedQueue, logger: Logger) {
    this.adapter = adapter;
    this.sessions = sessions;
    this.outbox = outbox;
    this.queue = queue;
    this.logger = logger;
  }

  async resume(): Promise<void> {
    for (const session of this.sessions.list()) {
      if (session.desiredConnected) {
        await this.connect(session.sessionId);
      }
    }
  }

  async connect(sessionId: string): Promise<SessionSnapshot> {
    this.clearReconnect(sessionId);
    const current = this.sessions.get(sessionId);
    this.setStatus(sessionId, "connecting", { desiredConnected: true, phoneNumber: current?.phoneNumber });
    await this.adapter.connect(sessionId, this);
    return this.snapshot(sessionId);
  }

  async disconnect(sessionId: string, logout: boolean): Promise<SessionSnapshot> {
    this.clearReconnect(sessionId);
    const current = this.sessions.get(sessionId);
    this.sessions.save({
      sessionId,
      status: logout ? "needs_qr" : "disconnected",
      phoneNumber: logout ? undefined : current?.phoneNumber,
      desiredConnected: false
    });
    this.qrCodes.delete(sessionId);
    await this.adapter.disconnect(sessionId, logout);
    return this.snapshot(sessionId);
  }

  snapshot(sessionId: string): SessionSnapshot {
    const record = this.sessions.get(sessionId);
    return {
      sessionId,
      status: record?.status ?? "disconnected",
      phoneNumber: record?.phoneNumber,
      qr: this.qrCodes.get(sessionId),
      lastError: record?.lastError,
      updatedAt: record?.updatedAt ?? new Date(0).toISOString()
    };
  }

  list(): SessionSnapshot[] {
    return this.sessions.list().map((session) => this.snapshot(session.sessionId));
  }

  qr(sessionId: string): string | undefined {
    return this.qrCodes.get(sessionId);
  }

  async send(sessionId: string, command: SendMessageCommand): Promise<{ messageId: string; chatId: string }> {
    if (this.sessions.get(sessionId)?.status !== "connected") {
      throw new SessionNotConnectedError(`session ${sessionId} is not connected`);
    }

    const metrics = this.metricsFor(sessionId);
    try {
      const result = await this.queue.run(sessionId, () => this.adapter.send(sessionId, command));
      metrics.sent++;
      return result;
    } catch (error) {
      metrics.sendFailures++;
      throw error;
    }
  }

  editMessage(sessionId: string, messageId: string, command: EditMessageCommand): Promise<void> {
    return this.queue.run(sessionId, () => this.adapter.editMessage(sessionId, messageId, command));
  }

  deleteMessage(sessionId: string, messageId: string, command: DeleteMessageCommand): Promise<void> {
    return this.queue.run(sessionId, () => this.adapter.deleteMessage(sessionId, messageId, command));
  }

  markRead(sessionId: string, command: ReadMessagesCommand): Promise<void> {
    return this.adapter.markRead(sessionId, command);
  }

  checkNumber(sessionId: string, number: string): Promise<NumberCheck> {
    return this.adapter.checkNumber(sessionId, number);
  }

  profilePictureUrl(sessionId: string, jid: string): Promise<string | undefined> {
    return this.adapter.profilePictureUrl(sessionId, jid);
  }

  contacts(sessionId: string): Promise<PhoneContact[]> {
    return this.adapter.contacts(sessionId);
  }

  pendingSends(sessionId: string): number {
    return this.queue.pending(sessionId);
  }

  allMetrics(): Record<string, SessionMetrics & { status: SessionStatus; pendingSends: number }> {
    const result: Record<string, SessionMetrics & { status: SessionStatus; pendingSends: number }> = {};
    for (const session of this.sessions.list()) {
      result[session.sessionId] = { ...this.metricsFor(session.sessionId), status: session.status, pendingSends: this.queue.pending(session.sessionId) };
    }
    return result;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    await this.queue.idle();
    await this.adapter.shutdown();
  }

  onConnection(sessionId: string, update: ConnectionState): void {
    const current = this.sessions.get(sessionId);
    const desiredConnected = current?.desiredConnected ?? false;

    switch (update.state) {
      case "connecting":
        this.setStatus(sessionId, "connecting", { desiredConnected, phoneNumber: current?.phoneNumber });
        return;
      case "qr":
        this.qrCodes.set(sessionId, update.qr);
        this.setStatus(sessionId, "qr", { desiredConnected, phoneNumber: current?.phoneNumber });
        this.outbox.enqueue({ type: "qr", sessionId, qr: update.qr });
        return;
      case "open":
        this.qrCodes.delete(sessionId);
        this.retries.delete(sessionId);
        this.setStatus(sessionId, "connected", { desiredConnected: true, phoneNumber: update.phoneNumber ?? current?.phoneNumber });
        return;
      case "closed":
        this.handleClosed(sessionId, update.reason, update.loggedOut, desiredConnected, current?.phoneNumber);
        return;
    }
  }

  onMessage(sessionId: string, message: Parameters<AdapterListener["onMessage"]>[1]): void {
    this.metricsFor(sessionId).received++;
    this.outbox.enqueue({ type: "message.received", sessionId, message });
  }

  onStatus(sessionId: string, messageId: string, chatId: string, status: Parameters<AdapterListener["onStatus"]>[3]): void {
    this.outbox.enqueue({ type: "message.status", sessionId, messageId, chatId, status });
  }

  private handleClosed(sessionId: string, reason: string, loggedOut: boolean, desiredConnected: boolean, phoneNumber?: string): void {
    this.qrCodes.delete(sessionId);

    if (loggedOut) {
      this.setStatus(sessionId, "needs_qr", { desiredConnected: false, reason });
      return;
    }

    if (!desiredConnected || this.stopping) {
      this.setStatus(sessionId, "disconnected", { desiredConnected, phoneNumber, reason });
      return;
    }

    const attempt = (this.retries.get(sessionId) ?? 0) + 1;
    this.retries.set(sessionId, attempt);
    this.metricsFor(sessionId).reconnects++;
    const delay = Math.min(60000, 1000 * 2 ** Math.min(attempt - 1, 6));
    this.setStatus(sessionId, "connecting", { desiredConnected, phoneNumber, reason });
    this.logger.warn({ sessionId, reason, attempt, delay }, "session closed, reconnecting");
    this.clearReconnect(sessionId);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(sessionId);
      this.adapter.connect(sessionId, this).catch((error: unknown) => {
        this.logger.error({ err: error, sessionId }, "reconnect failed");
        this.handleClosed(sessionId, "reconnect_failed", false, true, phoneNumber);
      });
    }, delay);
    this.reconnectTimers.set(sessionId, timer);
  }

  private setStatus(
    sessionId: string,
    status: SessionStatus,
    details: { desiredConnected: boolean; phoneNumber?: string; reason?: string }
  ): void {
    const previous = this.sessions.get(sessionId);
    this.sessions.save({
      sessionId,
      status,
      phoneNumber: details.phoneNumber,
      lastError: status === "connected" ? undefined : (details.reason ?? previous?.lastError),
      desiredConnected: details.desiredConnected
    });
    if (previous?.status !== status) {
      this.outbox.enqueue({ type: "connection.update", sessionId, status, phoneNumber: details.phoneNumber, reason: details.reason });
    }
  }

  private clearReconnect(sessionId: string): void {
    const timer = this.reconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionId);
    }
  }

  private metricsFor(sessionId: string): SessionMetrics {
    let metrics = this.metrics.get(sessionId);
    if (!metrics) {
      metrics = { sent: 0, sendFailures: 0, received: 0, reconnects: 0 };
      this.metrics.set(sessionId, metrics);
    }
    return metrics;
  }
}
