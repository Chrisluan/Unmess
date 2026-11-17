import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import pino from "pino";
import { FakeAdapter } from "../src/adapters/fakeAdapter.ts";
import type { GatewayConfig } from "../src/config.ts";
import type { EventEnvelope } from "../src/contract.ts";
import { createGateway, type Gateway } from "../src/gateway.ts";

const TOKEN = "test-token";
const events: EventEnvelope[] = [];
let gateway: Gateway;
let baseUrl: string;

const config: GatewayConfig = {
  port: 0,
  mode: "fake",
  apiToken: TOKEN,
  coreWebhookUrl: "http://core.test/events",
  webhookSecret: "secret",
  dataDir: ".",
  mediaDir: "./media",
  encryptionKey: randomBytes(32),
  sendIntervalMs: 10,
  syncFullHistory: false,
  logLevel: "silent",
  outboxPollMs: 20,
  outboxMaxBackoffMs: 100
};

const fetcher = (async (_url: string, init: RequestInit) => {
  events.push(JSON.parse(String(init.body)) as EventEnvelope);
  return new Response(null, { status: 202 });
}) as typeof fetch;

async function call(method: string, path: string, body?: unknown, token = TOKEN): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function waitFor<T>(probe: () => T | undefined, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = probe();
    if (value !== undefined) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("condition not met in time");
}

before(async () => {
  gateway = createGateway(config, pino({ level: "silent" }), {
    databaseFile: ":memory:",
    fake: new FakeAdapter({ pairingDelayMs: 50, statusDelayMs: 10 }),
    fetcher
  });
  const server = await gateway.start();
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await gateway.stop();
});

test("health endpoints are public", async () => {
  assert.equal((await fetch(`${baseUrl}/health/live`)).status, 200);
  const ready = await fetch(`${baseUrl}/health/ready`);
  assert.equal(ready.status, 200);
  assert.equal(((await ready.json()) as { mode: string }).mode, "fake");
});

test("command api requires the token", async () => {
  assert.equal((await call("GET", "/v1/sessions", undefined, "wrong")).status, 401);
});

test("full session lifecycle in fake mode", async () => {
  const connect = await call("POST", "/v1/sessions/7/connect");
  assert.equal(connect.status, 202);

  const qr = await call("GET", "/v1/sessions/7/qr");
  assert.equal(qr.status, 200);
  assert.match(((await qr.json()) as { dataUrl: string }).dataUrl, /^data:image\/png;base64,/);

  await waitFor(() => (gateway.sessions.snapshot("7").status === "connected" ? true : undefined));

  const sent = await call("POST", "/v1/sessions/7/messages", { to: "5511999990000", text: "Olá" });
  assert.equal(sent.status, 200);
  const { messageId, chatId } = (await sent.json()) as { messageId: string; chatId: string };
  assert.equal(chatId, "5511999990000@s.whatsapp.net");

  await waitFor(() =>
    events.find((envelope) => envelope.event.type === "message.status" && envelope.event.messageId === messageId && envelope.event.status === "read")
  );

  const inbound = await call("POST", "/v1/fake/sessions/7/inbound", { from: "5511888880000", text: "Oi", pushName: "Cliente" });
  assert.equal(inbound.status, 202);
  const received = await waitFor(() => events.find((envelope) => envelope.event.type === "message.received"));
  assert.equal(received.event.type === "message.received" && received.event.message.text, "Oi");

  const types = events.filter((envelope) => envelope.event.type === "connection.update").map((envelope) => envelope.event.type === "connection.update" && envelope.event.status);
  assert.deepEqual(types.slice(0, 3), ["connecting", "qr", "connected"]);
  assert.equal(new Set(events.map((envelope) => envelope.id)).size, events.length);

  assert.equal(received.event.type === "message.received" && received.event.message.sender.number, "5511888880000");

  const group = await call("POST", "/v1/fake/sessions/7/inbound", { from: "5511777770000", text: "Oi grupo", groupId: "1203630", groupName: "Equipe" });
  assert.equal(group.status, 202);
  const fromGroup = await waitFor(() =>
    events.find((envelope) => envelope.event.type === "message.received" && envelope.event.message.isGroup)
  );
  assert.equal(fromGroup.event.type === "message.received" && fromGroup.event.message.group?.name, "Equipe");

  assert.equal((await call("PUT", `/v1/sessions/7/messages/${messageId}`, { chatId: chatId, text: "Editado" })).status, 204);
  assert.equal((await call("DELETE", `/v1/sessions/7/messages/${messageId}`, { chatId: chatId, fromMe: true })).status, 204);
  assert.equal((await call("POST", "/v1/sessions/7/read", { chatId: "5511888880000@c.us", messageIds: ["A", "B"] })).status, 204);
  assert.equal((await call("PUT", `/v1/sessions/7/messages/${messageId}`, { text: "sem chat" })).status, 400);

  const check = await call("GET", "/v1/sessions/7/numbers/5585999990000");
  assert.deepEqual(await check.json(), { exists: true, jid: "5585999990000@s.whatsapp.net" });
  assert.deepEqual(await (await call("GET", "/v1/sessions/7/numbers/123")).json(), { exists: false });
  assert.deepEqual(await (await call("GET", "/v1/sessions/7/profile-picture?jid=5585999990000")).json(), { url: null });
  assert.equal(((await (await call("GET", "/v1/sessions/7/contacts")).json()) as unknown[]).length, 2);

  const logout = await call("POST", "/v1/sessions/7/disconnect", { logout: true });
  assert.equal(((await logout.json()) as { status: string }).status, "needs_qr");
  assert.equal((await call("POST", "/v1/sessions/7/messages", { to: "5511", text: "x" })).status, 409);
  assert.equal((await call("GET", "/v1/sessions/7/numbers/5585999990000")).status, 409);
});

test("rejects invalid input", async () => {
  assert.equal((await call("POST", "/v1/sessions/8/messages", { text: "sem destino" })).status, 400);
  assert.equal((await call("GET", "/v1/sessions/bad%20id")).status, 400);
});
