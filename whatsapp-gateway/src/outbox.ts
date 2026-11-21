import { createHmac, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { CONTRACT_VERSION, type EventEnvelope, type GatewayEvent } from "./contract.ts";
import type { Logger } from "./logger.ts";

export const TIMESTAMP_HEADER = "X-Unmess-Timestamp";
export const SIGNATURE_HEADER = "X-Unmess-Signature";
export const DELIVERY_HEADER = "X-Unmess-Delivery";

export function signBody(secret: string, timestamp: number, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export interface OutboxOptions {
  webhookUrl: string;
  secret: string;
  pollMs: number;
  maxBackoffMs: number;
}

interface OutboxRow {
  id: string;
  payload: string;
  attempts: number;
}

export class Outbox {
  private readonly db: DatabaseSync;
  private readonly options: OutboxOptions;
  private readonly logger: Logger;
  private readonly fetcher: typeof fetch;
  private timer: NodeJS.Timeout | undefined;
  private draining: Promise<void> | undefined;
  private delivered = 0;
  private failedAttempts = 0;

  constructor(db: DatabaseSync, options: OutboxOptions, logger: Logger, fetcher: typeof fetch = fetch) {
    this.db = db;
    this.options = options;
    this.logger = logger;
    this.fetcher = fetcher;
  }

  enqueue(event: GatewayEvent): EventEnvelope {
    const envelope: EventEnvelope = {
      id: randomUUID(),
      version: CONTRACT_VERSION,
      occurredAt: new Date().toISOString(),
      event
    };
    this.db
      .prepare("INSERT INTO outbox (id, payload, attempts, next_attempt_at, created_at) VALUES (?, ?, 0, ?, ?)")
      .run(envelope.id, JSON.stringify(envelope), Date.now(), Date.now());
    this.kick();
    return envelope;
  }

  pending(): number {
    return (this.db.prepare("SELECT COUNT(*) AS total FROM outbox").get() as { total: number }).total;
  }

  stats(): { pending: number; delivered: number; failedAttempts: number } {
    return { pending: this.pending(), delivered: this.delivered, failedAttempts: this.failedAttempts };
  }

  start(): void {
    this.timer = setInterval(() => this.kick(), this.options.pollMs);
    this.timer.unref();
    this.kick();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.draining;
  }

  kick(): void {
    if (!this.draining) {
      this.draining = this.drainOnce().finally(() => {
        this.draining = undefined;
      });
    }
  }

  drain(): Promise<void> {
    this.kick();
    return this.draining ?? Promise.resolve();
  }

  private async drainOnce(): Promise<void> {
    while (true) {
      const rows = this.db
        .prepare("SELECT id, payload, attempts, next_attempt_at AS nextAttemptAt FROM outbox ORDER BY created_at, rowid LIMIT 20")
        .all() as unknown as (OutboxRow & { nextAttemptAt: number })[];
      if (rows.length === 0) {
        return;
      }

      for (const row of rows) {
        if (row.nextAttemptAt > Date.now() || !(await this.deliver(row))) {
          return;
        }
      }
    }
  }

  private async deliver(row: OutboxRow): Promise<boolean> {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      const response = await this.fetcher(this.options.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [TIMESTAMP_HEADER]: String(timestamp),
          [SIGNATURE_HEADER]: signBody(this.options.secret, timestamp, row.payload),
          [DELIVERY_HEADER]: row.id
        },
        body: row.payload,
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        this.db.prepare("DELETE FROM outbox WHERE id = ?").run(row.id);
        this.delivered++;
        return true;
      }

      this.reschedule(row, `HTTP ${response.status}`);
      return false;
    } catch (error) {
      this.reschedule(row, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private reschedule(row: OutboxRow, reason: string): void {
    const attempts = row.attempts + 1;
    const delay = Math.min(this.options.maxBackoffMs, 1000 * 2 ** Math.min(attempts, 16));
    this.failedAttempts++;
    this.db
      .prepare("UPDATE outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?")
      .run(attempts, Date.now() + delay, reason, row.id);
    this.logger.warn({ eventId: row.id, attempts, retryInMs: delay, reason }, "event delivery to core failed");
  }
}
