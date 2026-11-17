import path from "node:path";

export type GatewayMode = "baileys" | "fake";

export interface GatewayConfig {
  port: number;
  mode: GatewayMode;
  apiToken: string;
  coreWebhookUrl: string;
  webhookSecret: string;
  dataDir: string;
  mediaDir: string;
  encryptionKey: Buffer;
  sendIntervalMs: number;
  syncFullHistory: boolean;
  logLevel: string;
  outboxPollMs: number;
  outboxMaxBackoffMs: number;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} must be configured.`);
  }
  return value.trim();
}

function parseKey(raw: string): Buffer {
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("GATEWAY_ENCRYPTION_KEY must be 32 bytes, as 64 hex characters or base64.");
  }
  return key;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const mode = (env.GATEWAY_MODE ?? "fake").trim();
  if (mode !== "baileys" && mode !== "fake") {
    throw new Error("GATEWAY_MODE must be baileys or fake.");
  }

  const dataDir = path.resolve(env.GATEWAY_DATA_DIR ?? "data");

  return {
    port: Number(env.GATEWAY_PORT ?? env.PORT ?? 8090),
    mode,
    apiToken: required(env, "GATEWAY_API_TOKEN"),
    coreWebhookUrl: required(env, "GATEWAY_CORE_WEBHOOK_URL"),
    webhookSecret: required(env, "GATEWAY_WEBHOOK_SECRET"),
    dataDir,
    mediaDir: path.resolve(env.GATEWAY_MEDIA_DIR ?? path.join(dataDir, "media")),
    encryptionKey: parseKey(required(env, "GATEWAY_ENCRYPTION_KEY")),
    sendIntervalMs: Number(env.GATEWAY_SEND_INTERVAL_MS ?? 1500),
    syncFullHistory: env.GATEWAY_SYNC_FULL_HISTORY === "true",
    logLevel: env.LOG_LEVEL ?? "info",
    outboxPollMs: Number(env.GATEWAY_OUTBOX_POLL_MS ?? 1000),
    outboxMaxBackoffMs: Number(env.GATEWAY_OUTBOX_MAX_BACKOFF_MS ?? 60000)
  };
}
