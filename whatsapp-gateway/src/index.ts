import { loadConfig } from "./config.ts";
import { createGateway } from "./gateway.ts";
import { createLogger } from "./logger.ts";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const gateway = createGateway(config, logger);

await gateway.start();
logger.info({ port: config.port, mode: config.mode }, "whatsapp gateway listening");

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) {
      return;
    }
    stopping = true;
    logger.info({ signal }, "shutting down");
    const forced = setTimeout(() => process.exit(1), 15000);
    forced.unref();
    gateway
      .stop()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error({ err: error }, "shutdown failed");
        process.exit(1);
      });
  });
}
