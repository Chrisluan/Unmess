import assert from "node:assert/strict";
import { test } from "node:test";
import pino from "pino";
import { DELIVERY_HEADER, Outbox, SIGNATURE_HEADER, signBody, TIMESTAMP_HEADER } from "../src/outbox.ts";
import { PacedQueue } from "../src/sendQueue.ts";
import { openDatabase } from "../src/storage/database.ts";

const logger = pino({ level: "silent" });

test("delivers signed events and removes them", async () => {
  const db = openDatabase(".", ":memory:");
  const received: { headers: Headers; body: string }[] = [];
  const fetcher = (async (_url: string, init: RequestInit) => {
    received.push({ headers: new Headers(init.headers), body: String(init.body) });
    return new Response(null, { status: 202 });
  }) as typeof fetch;
  const outbox = new Outbox(db, { webhookUrl: "http://core", secret: "s3cret", pollMs: 1000, maxBackoffMs: 1000 }, logger, fetcher);

  const envelope = outbox.enqueue({ type: "qr", sessionId: "1", qr: "abc" });
  await outbox.drain();

  assert.equal(received.length, 1);
  const { headers, body } = received[0]!;
  const timestamp = Number(headers.get(TIMESTAMP_HEADER));
  assert.equal(headers.get(SIGNATURE_HEADER), signBody("s3cret", timestamp, body));
  assert.equal(headers.get(DELIVERY_HEADER), envelope.id);
  assert.equal(JSON.parse(body).event.qr, "abc");
  assert.equal(outbox.pending(), 0);
});

test("keeps events and backs off while the core is down", async () => {
  const db = openDatabase(".", ":memory:");
  let up = false;
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    if (!up) {
      throw new Error("connection refused");
    }
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  const outbox = new Outbox(db, { webhookUrl: "http://core", secret: "s", pollMs: 1000, maxBackoffMs: 1000 }, logger, fetcher);

  outbox.enqueue({ type: "qr", sessionId: "1", qr: "a" });
  outbox.enqueue({ type: "qr", sessionId: "1", qr: "b" });
  await outbox.drain();
  assert.equal(outbox.pending(), 2);
  assert.equal(calls, 1);

  await outbox.drain();
  assert.equal(calls, 1);

  up = true;
  db.prepare("UPDATE outbox SET next_attempt_at = 0").run();
  await outbox.drain();
  assert.equal(outbox.pending(), 0);
});

test("paced queue serializes sends per session with a minimum interval", async () => {
  const queue = new PacedQueue(50);
  const starts: number[] = [];
  const begin = Date.now();

  await Promise.all([1, 2, 3].map(() => queue.run("s1", async () => starts.push(Date.now() - begin))));
  await queue.run("s2", async () => starts.push(-1));

  assert.equal(starts.length, 4);
  assert.ok(starts[1]! - starts[0]! >= 45);
  assert.ok(starts[2]! - starts[1]! >= 45);
});
