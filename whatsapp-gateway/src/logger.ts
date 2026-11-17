import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: "whatsapp-gateway" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ["apiToken", "webhookSecret", "encryptionKey", "*.creds", "headers.authorization"]
  });
}
