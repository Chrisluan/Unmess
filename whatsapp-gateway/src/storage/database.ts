import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(dataDir: string, fileName = "gateway.db"): DatabaseSync {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(fileName === ":memory:" ? ":memory:" : path.join(dataDir, fileName));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_state (
      session_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value BLOB NOT NULL,
      PRIMARY KEY (session_id, key)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      phone_number TEXT,
      last_error TEXT,
      desired_connected INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL,
      last_error TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS outbox_next_attempt ON outbox (next_attempt_at);
  `);
  return db;
}
