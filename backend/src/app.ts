import "./bootstrap";
import "reflect-metadata";
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";

import helmet from "helmet";
import compression from "compression";

import "./database";
import uploadConfig from "./config/upload";
import AppError from "./errors/AppError";
import routes from "./routes";
import { logger } from "./utils/logger";
import { isAllowedOrigin } from "./helpers/IsAllowedOrigin";
import { limitadorGeral, limitadorLogin } from "./middleware/limitarRequisicoes";

Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

/**
 * O túnel é quem termina o TLS; para o Express, a conexão chega em HTTP puro a
 * partir de 127.0.0.1. Sem confiar no proxy, `req.ip` seria sempre o loopback
 * -- e o limitador de requisições contaria o mundo inteiro como um visitante
 * só, deixando um ataque de força bruta passar como se fosse tráfego normal.
 *
 * O valor 1 é deliberado: confia num único salto (o cloudflared/tailscaled
 * rodando nesta máquina). Confiar em todos deixaria qualquer um forjar
 * X-Forwarded-For e escapar do limite.
 */
app.set("trust proxy", 1);

/**
 * Comprime as respostas.
 *
 * Listas de conversas e de oportunidades sao JSON repetitivo, que encolhe
 * muito -- e o trecho entre esta maquina e a Cloudflare passa por um Wi-Fi
 * compartilhado com o atendimento. O ganho aparece justamente nas telas que
 * carregam muita coisa de uma vez.
 *
 * Respostas pequenas passam direto: abaixo de 1 KB, comprimir custa mais CPU
 * do que economiza em rede, e esta maquina tem dois nucleos.
 */
app.use(compression({ threshold: 1024 }));

// Cabeçalhos de segurança. A CSP fica desligada porque quem entrega o HTML é o
// servidor do frontend, não este; ligá-la aqui só afetaria respostas de API e
// daria falsa sensação de proteção.
app.use(
  helmet({
    contentSecurityPolicy: false,
    // Os anexos são consumidos pelo frontend, que está em outro host quando o
    // acesso vem pela internet; a política padrão bloquearia as imagens.
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    }
  })
);
app.use(cookieParser());

// Teto no corpo da requisição: sem isto, um único POST grande o bastante ocupa
// a memória da máquina inteira, que divide 8 GB com o banco e o WhatsApp.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(Sentry.Handlers.requestHandler());

app.use(limitadorGeral);

app.use("/public", express.static(uploadConfig.directory));
app.use(routes);

app.use(Sentry.Handlers.errorHandler());

app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
