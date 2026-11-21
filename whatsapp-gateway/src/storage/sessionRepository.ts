import type { DatabaseSync } from "node:sqlite";
import type { SessionStatus } from "../contract.ts";

export interface SessionRecord {
  sessionId: string;
  status: SessionStatus;
  phoneNumber?: string;
  lastError?: string;
  desiredConnected: boolean;
  updatedAt: string;
}

interface SessionRow {
  session_id: string;
  status: string;
  phone_number: string | null;
  last_error: string | null;
  desired_connected: number;
  updated_at: string;
}

function toRecord(row: SessionRow): SessionRecord {
  return {
    sessionId: row.session_id,
    status: row.status as SessionStatus,
    phoneNumber: row.phone_number ?? undefined,
    lastError: row.last_error ?? undefined,
    desiredConnected: row.desired_connected === 1,
    updatedAt: row.updated_at
  };
}

export class SessionRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  get(sessionId: string): SessionRecord | undefined {
    const row = this.db.prepare("SELECT * FROM sessions WHERE session_id = ?").get(sessionId) as SessionRow | undefined;
    return row ? toRecord(row) : undefined;
  }

  list(): SessionRecord[] {
    return (this.db.prepare("SELECT * FROM sessions ORDER BY session_id").all() as unknown as SessionRow[]).map(toRecord);
  }

  save(record: Omit<SessionRecord, "updatedAt">): SessionRecord {
    const updatedAt = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO sessions (session_id, status, phone_number, last_error, desired_connected, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (session_id) DO UPDATE SET
          status = excluded.status,
          phone_number = excluded.phone_number,
          last_error = excluded.last_error,
          desired_connected = excluded.desired_connected,
          updated_at = excluded.updated_at`)
      .run(
        record.sessionId,
        record.status,
        record.phoneNumber ?? null,
        record.lastError ?? null,
        record.desiredConnected ? 1 : 0,
        updatedAt
      );
    return { ...record, updatedAt };
  }
}
