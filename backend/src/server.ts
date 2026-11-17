import gracefulShutdown from "http-graceful-shutdown";
import http from "http";
import https from "https";
import { existsSync, readFileSync } from "fs";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { initRedis } from "./libs/redisStore";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import { startCloseInactiveTicketsJob } from "./jobs/CloseInactiveTicketsJob";
import { startBloqueioPorInadimplenciaJob } from "./jobs/BloqueioPorInadimplenciaJob";
import { resetAllUsersPresence } from "./helpers/ResetPresence";
import { verificarRotasProtegidas } from "./helpers/permissions/routeGuard";

const PORT = Number(process.env.PORT) || 3000;

/**
 * Sobe em HTTPS quando há certificado configurado.
 *
 * Uma página servida por HTTPS não pode chamar uma API em HTTP — o navegador
 * bloqueia como conteúdo misto. Como o frontend precisa de HTTPS para liberar
 * o microfone fora do localhost, a API tem que acompanhar.
 *
 * Sem os arquivos de certificado, continua em HTTP: o desenvolvimento local
 * não precisa deles.
 */
const criarServidor = () => {
  const certPath = process.env.SSL_CERT_PATH;
  const keyPath = process.env.SSL_KEY_PATH;

  if (certPath && keyPath && existsSync(certPath) && existsSync(keyPath)) {
    logger.info("TLS habilitado");
    return https.createServer(
      { cert: readFileSync(certPath), key: readFileSync(keyPath) },
      app
    );
  }

  if (certPath || keyPath) {
    logger.warn(
      "SSL_CERT_PATH/SSL_KEY_PATH definidos mas os arquivos não foram encontrados; subindo sem TLS."
    );
  }

  return http.createServer(app);
};

/**
 * Confere que toda rota declara como se protege.
 *
 * O jeito como um endpoint desprotegido aparece é ninguém reparar nele — foi
 * assim que iniciar, reiniciar e desconectar o WhatsApp da empresa ficaram
 * pedindo login e mais nada. Fora de produção isso lança e quebra o boot; em
 * produção vira erro no log e o sistema sobe, porque um alarme com defeito não
 * pode ter o poder de desligar o produto.
 */
verificarRotasProtegidas(mensagem => logger.error(mensagem));

const server = criarServidor().listen(PORT, "0.0.0.0", () => {
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
startBloqueioPorInadimplenciaJob();
gracefulShutdown(server);

process.on("uncaughtException", err => {
  logger.error({ info: "Global uncaught exception", err });
});

process.on("unhandledRejection", err => {
  if (err) logger.error({ info: "Global unhandled rejection", err });
});
