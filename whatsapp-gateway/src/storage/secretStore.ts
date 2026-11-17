import type { DatabaseSync } from "node:sqlite";
import { decrypt, encrypt } from "./encryption.ts";

export class SecretStore {
  private readonly db: DatabaseSync;
  private readonly key: Buffer;

  constructor(db: DatabaseSync, key: Buffer) {
    this.db = db;
    this.key = key;
  }

  read(sessionId: string, name: string): string | undefined {
    const row = this.db
      .prepare("SELECT value FROM auth_state WHERE session_id = ? AND key = ?")
      .get(sessionId, name) as { value: Uint8Array } | undefined;
    return row ? decrypt(this.key, row.value, `${sessionId}:${name}`) : undefined;
  }

  write(sessionId: string, name: string, value: string): void {
    this.db
      .prepare("INSERT INTO auth_state (session_id, key, value) VALUES (?, ?, ?) ON CONFLICT (session_id, key) DO UPDATE SET value = excluded.value")
      .run(sessionId, name, encrypt(this.key, value, `${sessionId}:${name}`));
  }

  remove(sessionId: string, name: string): void {
    this.db.prepare("DELETE FROM auth_state WHERE session_id = ? AND key = ?").run(sessionId, name);
  }

  clear(sessionId: string): void {
    this.db.prepare("DELETE FROM auth_state WHERE session_id = ?").run(sessionId);
  }

  transaction(work: () => void): void {
    this.db.exec("BEGIN");
    try {
      work();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
