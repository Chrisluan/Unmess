import assert from "node:assert/strict";
import { test } from "node:test";
import type { proto } from "baileys";
import { bodyOf, kindOf, mediaFileName, quotedIdOf, resolveIdentity, shouldHandle } from "../src/adapters/inbound.ts";

test("bodies follow the core format", () => {
  assert.equal(bodyOf("conversation", { conversation: "oi" }), "oi");
  assert.equal(bodyOf("imageMessage", { imageMessage: { caption: "foto" } }), "foto");
  assert.equal(
    bodyOf("locationMessage", { locationMessage: { degreesLatitude: -3.7, degreesLongitude: -38.5, name: "Loja" } }),
    "https://maps.google.com/maps?q=-3.7%2C-38.5&z=17&hl=pt-BR|Loja"
  );
  assert.equal(
    bodyOf("contactsArrayMessage", { contactsArrayMessage: { contacts: [{ vcard: "A" }, { vcard: "B" }] } }),
    "A\nB"
  );
});

test("kinds map voice notes separately", () => {
  assert.equal(kindOf("audioMessage", { audioMessage: { ptt: true } }), "voice");
  assert.equal(kindOf("audioMessage", { audioMessage: {} }), "audio");
  assert.equal(kindOf("contactMessage", {}), "contact");
});

test("filters unsupported, silent and own non-media messages", () => {
  const text: proto.IMessage = { conversation: "oi" };
  assert.equal(shouldHandle("conversation", text, false), true);
  assert.equal(shouldHandle("conversation", text, true), true);
  assert.equal(shouldHandle("conversation", { conversation: "‎menu" }, false), false);
  assert.equal(shouldHandle("reactionMessage", {}, false), false);
  assert.equal(shouldHandle("stickerMessage", { stickerMessage: {} }, true), true);
  assert.equal(shouldHandle("contactsArrayMessage", { contactsArrayMessage: { contacts: [] } }, true), false);
});

test("quoted ids and media names", () => {
  assert.equal(quotedIdOf({ extendedTextMessage: { text: "x", contextInfo: { stanzaId: "Q1" } } }), "Q1");
  assert.equal(mediaFileName("imageMessage", {}, "image/png", 1), "image-1.png");
  assert.equal(mediaFileName("audioMessage", {}, "audio/ogg; codecs=opus", 1), "audio-1.ogg");
  assert.equal(mediaFileName("documentMessage", { documentMessage: { fileName: "nota.pdf" } }, "application/pdf", 1), "nota.pdf");
});

test("prefers the phone number over a lid and keeps the lid", () => {
  const fromLid = resolveIdentity("123456@lid", { senderPn: "5585999990000@s.whatsapp.net" }, {});
  assert.deepEqual(fromLid, { jid: "5585999990000@s.whatsapp.net", number: "5585999990000", lid: "123456@lid" });

  const plain = resolveIdentity("5585999990000@s.whatsapp.net", {}, {});
  assert.deepEqual(plain, { jid: "5585999990000@s.whatsapp.net", number: "5585999990000", lid: undefined });

  const onlyLid = resolveIdentity("777@lid", {}, {});
  assert.deepEqual(onlyLid, { jid: "777@lid", number: "777", lid: "777@lid" });
});
