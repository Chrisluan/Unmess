import type { Server } from "node:http";
import type { DatabaseSync } from "node:sqlite";
import { BaileysAdapter } from "./adapters/baileysAdapter.ts";
import { FakeAdapter } from "./adapters/fakeAdapter.ts";
import type { WhatsappAdapter } from "./adapters/adapter.ts";
import type { GatewayConfig } from "./config.ts";
import { createApp } from "./http/app.ts";
import type { Logger } from "./logger.ts";
import { MediaStore } from "./media.ts";
import { Outbox } from "./outbox.ts";
import { PacedQueue } from "./sendQueue.ts";
import { SessionManager } from "./sessionManager.ts";
import { openDatabase } from "./storage/database.ts";
import { SecretStore } from "./storage/secretStore.ts";
import { SessionRepository } from "./storage/sessionRepository.ts";

export interface Gateway {
  app: ReturnType<typeof createApp>;
  db: DatabaseSync;
  sessions: SessionManager;
  outbox: Outbox;
  fake?: FakeAdapter;
  start(): Promise<Server>;
  stop(): Promise<void>;
}

export interface GatewayOverrides {
  databaseFile?: string;
  fake?: FakeAdapter;
  fetcher?: typeof fetch;
}

export function createGateway(config: GatewayConfig, logger: Logger, overrides: GatewayOverrides = {}): Gateway {
  const db = openDatabase(config.dataDir, overrides.databaseFile);
  const outbox = new Outbox(
    db,
    {
      webhookUrl: config.coreWebhookUrl,
      secret: config.webhookSecret,
      pollMs: config.outboxPollMs,
      maxBackoffMs: config.outboxMaxBackoffMs
    },
    logger,
    overrides.fetcher
  );

  const fake = config.mode === "fake" ? (overrides.fake ?? new FakeAdapter()) : undefined;
  const adapter: WhatsappAdapter =
    fake ?? new BaileysAdapter(new SecretStore(db, config.encryptionKey), new MediaStore(config.mediaDir), logger, { syncFullHistory: config.syncFullHistory });

  const sessions = new SessionManager(adapter, new SessionRepository(db), outbox, new PacedQueue(config.sendIntervalMs), logger);
  const app = createApp({ apiToken: config.apiToken, mode: config.mode, db, sessions, outbox, logger, fake });
  let server: Server | undefined;

  return {
    app,
    db,
    sessions,
    outbox,
    fake,
    async start() {
      outbox.start();
      await sessions.resume();
      server = await new Promise<Server>((resolve) => {
        const listening = app.listen(config.port, () => resolve(listening));
      });
      return server;
    },
    async stop() {
      if (server) {
        await new Promise<void>((resolve) => server?.close(() => resolve()));
      }
      await sessions.stop();
      await outbox.stop();
      db.close();
    }
  };
}
