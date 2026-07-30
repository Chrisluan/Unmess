import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { initRedis } from "./libs/redisStore";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import { startCloseInactiveTicketsJob } from "./jobs/CloseInactiveTicketsJob";
import { resetAllUsersPresence } from "./helpers/ResetPresence";

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info(`Server started on port ${PORT}`);
});

initIO(server);
initRedis();
// Reinício do processo derruba todos os sockets: ninguém está realmente
// online até reconectar. Sem isso a distribuição automática entregaria
// chats para atendentes fantasma.
resetAllUsersPresence();
StartAllWhatsAppsSessions();
startCloseInactiveTicketsJob();
gracefulShutdown(server);

process.on("uncaughtException", err => {
  logger.error({ info: "Global uncaught exception", err });
});

process.on("unhandledRejection", err => {
  if (err) logger.error({ info: "Global unhandled rejection", err });
});
