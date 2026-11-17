import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import QRCode from "qrcode";
import type { DeleteMessageCommand, EditMessageCommand, ReadMessagesCommand, SendMessageCommand } from "../contract.ts";
import { SessionUnavailableError } from "../adapters/adapter.ts";
import type { FakeAdapter } from "../adapters/fakeAdapter.ts";
import type { Logger } from "../logger.ts";
import type { Outbox } from "../outbox.ts";
import { SessionNotConnectedError, type SessionManager } from "../sessionManager.ts";

const SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CONTRACT_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "openapi.yaml");

export interface AppDependencies {
  apiToken: string;
  mode: string;
  db: DatabaseSync;
  sessions: SessionManager;
  outbox: Outbox;
  logger: Logger;
  fake?: FakeAdapter;
}

export function createApp(deps: AppDependencies): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health/live", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/health/ready", (_req, res) => {
    try {
      deps.db.prepare("SELECT 1").get();
      res.json({ status: "ok", mode: deps.mode, outboxPending: deps.outbox.pending() });
    } catch (error) {
      deps.logger.error({ err: error }, "readiness check failed");
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.get("/openapi.yaml", (_req, res) => {
    res.type("application/yaml").sendFile(CONTRACT_FILE);
  });

  const v1 = express.Router();
  v1.use(requireToken(deps.apiToken));
  v1.param("sessionId", (req, res, next, value: string) => {
    if (!SESSION_ID.test(value)) {
      res.status(400).json({ error: "invalid_session_id" });
      return;
    }
    next();
  });

  v1.get("/metrics", (_req, res) => {
    res.json({ mode: deps.mode, outbox: deps.outbox.stats(), sessions: deps.sessions.allMetrics() });
  });

  v1.get("/sessions", (_req, res) => {
    res.json(deps.sessions.list());
  });

  v1.get("/sessions/:sessionId", (req, res) => {
    res.json(deps.sessions.snapshot(req.params.sessionId as string));
  });

  v1.post("/sessions/:sessionId/connect", async (req, res) => {
    res.status(202).json(await deps.sessions.connect(req.params.sessionId as string));
  });

  v1.post("/sessions/:sessionId/disconnect", async (req, res) => {
    const logout = (req.body as { logout?: unknown } | undefined)?.logout === true;
    res.json(await deps.sessions.disconnect(req.params.sessionId as string, logout));
  });

  v1.get("/sessions/:sessionId/qr", async (req, res) => {
    const qr = deps.sessions.qr(req.params.sessionId as string);
    if (!qr) {
      res.status(404).json({ error: "qr_not_available" });
      return;
    }
    res.json({ qr, dataUrl: await QRCode.toDataURL(qr) });
  });

  v1.post("/sessions/:sessionId/messages", async (req, res) => {
    const command = req.body as SendMessageCommand | undefined;
    const problem = validateSend(command);
    if (problem) {
      res.status(400).json({ error: problem });
      return;
    }
    try {
      res.json(await deps.sessions.send(req.params.sessionId as string, command as SendMessageCommand));
    } catch (error) {
      if (error instanceof SessionNotConnectedError) {
        res.status(409).json({ error: "session_not_connected" });
        return;
      }
      throw error;
    }
  });

  v1.put("/sessions/:sessionId/messages/:messageId", async (req, res) => {
    const body = req.body as Partial<EditMessageCommand> | undefined;
    if (!body?.chatId || !body.text) {
      res.status(400).json({ error: "chat_id_and_text_required" });
      return;
    }
    await deps.sessions.editMessage(req.params.sessionId as string, req.params.messageId as string, { chatId: body.chatId, text: body.text });
    res.status(204).end();
  });

  v1.delete("/sessions/:sessionId/messages/:messageId", async (req, res) => {
    const body = req.body as Partial<DeleteMessageCommand> | undefined;
    if (!body?.chatId) {
      res.status(400).json({ error: "chat_id_required" });
      return;
    }
    await deps.sessions.deleteMessage(req.params.sessionId as string, req.params.messageId as string, { chatId: body.chatId, fromMe: body.fromMe === true });
    res.status(204).end();
  });

  v1.post("/sessions/:sessionId/read", async (req, res) => {
    const body = req.body as Partial<ReadMessagesCommand> | undefined;
    if (!body?.chatId || !Array.isArray(body.messageIds)) {
      res.status(400).json({ error: "chat_id_and_message_ids_required" });
      return;
    }
    await deps.sessions.markRead(req.params.sessionId as string, { chatId: body.chatId, messageIds: body.messageIds.map(String) });
    res.status(204).end();
  });

  v1.get("/sessions/:sessionId/numbers/:number", async (req, res) => {
    res.json(await deps.sessions.checkNumber(req.params.sessionId as string, req.params.number as string));
  });

  v1.get("/sessions/:sessionId/profile-picture", async (req, res) => {
    const jid = typeof req.query.jid === "string" ? req.query.jid : "";
    if (!jid) {
      res.status(400).json({ error: "jid_required" });
      return;
    }
    res.json({ url: (await deps.sessions.profilePictureUrl(req.params.sessionId as string, jid)) ?? null });
  });

  v1.get("/sessions/:sessionId/contacts", async (req, res) => {
    res.json(await deps.sessions.contacts(req.params.sessionId as string));
  });

  if (deps.fake) {
    const fake = deps.fake;
    v1.post("/fake/sessions/:sessionId/inbound", (req, res) => {
      const body = req.body as { from?: string; text?: string; pushName?: string; groupId?: string; groupName?: string } | undefined;
      if (!body?.from || !body.text) {
        res.status(400).json({ error: "from_and_text_required" });
        return;
      }
      res.status(202).json({
        messageId: fake.simulateInbound(req.params.sessionId as string, {
          from: body.from,
          text: body.text,
          pushName: body.pushName,
          groupId: body.groupId,
          groupName: body.groupName
        })
      });
    });
  }

  app.use("/v1", v1);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SessionUnavailableError) {
      res.status(409).json({ error: "session_not_connected" });
      return;
    }
    deps.logger.error({ err: error }, "request failed");
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

function requireToken(expected: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const token = Buffer.from(header.startsWith("Bearer ") ? header.slice(7).trim() : "", "utf8");
    if (token.length !== expectedBuffer.length || !timingSafeEqual(token, expectedBuffer)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}

function validateSend(command: SendMessageCommand | undefined): string | undefined {
  if (!command || typeof command.to !== "string" || command.to.trim() === "") {
    return "to_required";
  }
  if (!command.text && !command.media) {
    return "text_or_media_required";
  }
  if (command.media && (typeof command.media.ref !== "string" || typeof command.media.mimetype !== "string")) {
    return "media_ref_and_mimetype_required";
  }
  return undefined;
}
