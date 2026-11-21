import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { useEncryptedAuthState } from "../src/adapters/baileysAuthState.ts";
import { openDatabase } from "../src/storage/database.ts";
import { decrypt, encrypt } from "../src/storage/encryption.ts";
import { SecretStore } from "../src/storage/secretStore.ts";

test("encryption round-trips and rejects another context", () => {
  const key = randomBytes(32);
  const payload = encrypt(key, "secret value", "s1:creds");

  assert.equal(decrypt(key, payload, "s1:creds"), "secret value");
  assert.throws(() => decrypt(key, payload, "s2:creds"));
  assert.throws(() => decrypt(randomBytes(32), payload, "s1:creds"));
});

test("stored values are not readable without the key", () => {
  const db = openDatabase(".", ":memory:");
  const store = new SecretStore(db, randomBytes(32));
  store.write("s1", "creds", "{\"noiseKey\":\"plain-text-marker\"}");

  const raw = db.prepare("SELECT value FROM auth_state").get() as { value: Uint8Array };
  assert.ok(!Buffer.from(raw.value).toString("utf8").includes("plain-text-marker"));
});

test("auth state persists creds and signal keys across reloads", async () => {
  const db = openDatabase(".", ":memory:");
  const store = new SecretStore(db, randomBytes(32));

  const first = useEncryptedAuthState(store, "s1");
  (first.state.creds as { registrationId: number }).registrationId = 4242;
  first.saveCreds();
  await first.state.keys.set({ session: { "123.0": new Uint8Array([1, 2, 3]) } });

  const second = useEncryptedAuthState(store, "s1");
  assert.equal(second.state.creds.registrationId, 4242);
  assert.ok(Buffer.isBuffer(second.state.creds.noiseKey.private));
  const keys = await second.state.keys.get("session", ["123.0", "missing"]);
  assert.deepEqual([...keys["123.0"]!], [1, 2, 3]);
  assert.equal(keys.missing, undefined);

  await second.state.keys.set({ session: { "123.0": null } });
  assert.deepEqual(await second.state.keys.get("session", ["123.0"]), {});
});

test("sessions are isolated", () => {
  const db = openDatabase(".", ":memory:");
  const store = new SecretStore(db, randomBytes(32));
  useEncryptedAuthState(store, "a").saveCreds();
  store.clear("b");

  assert.notEqual(store.read("a", "creds"), undefined);
  assert.equal(store.read("b", "creds"), undefined);
});
