import type { proto } from "baileys";
import type { MessageKind } from "../contract.ts";

export const SILENT_PREFIX = "‎";

const HANDLED_TYPES = new Set([
  "conversation",
  "extendedTextMessage",
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "stickerMessage",
  "locationMessage",
  "contactMessage",
  "contactsArrayMessage"
]);

const MEDIA_TYPES = new Set(["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"]);

const OWN_ALLOWED_TYPES = new Set(["locationMessage", "conversation", "extendedTextMessage", "contactMessage"]);

export function kindOf(contentType: string, content: proto.IMessage): MessageKind {
  switch (contentType) {
    case "conversation":
    case "extendedTextMessage":
      return "text";
    case "imageMessage":
      return "image";
    case "videoMessage":
      return "video";
    case "audioMessage":
      return content.audioMessage?.ptt ? "voice" : "audio";
    case "documentMessage":
      return "document";
    case "stickerMessage":
      return "sticker";
    case "locationMessage":
      return "location";
    case "contactMessage":
    case "contactsArrayMessage":
      return "contact";
    default:
      return "unknown";
  }
}

export function hasMedia(contentType: string): boolean {
  return MEDIA_TYPES.has(contentType);
}

export function bodyOf(contentType: string, content: proto.IMessage): string {
  switch (contentType) {
    case "conversation":
      return content.conversation ?? "";
    case "extendedTextMessage":
      return content.extendedTextMessage?.text ?? "";
    case "imageMessage":
      return content.imageMessage?.caption ?? "";
    case "videoMessage":
      return content.videoMessage?.caption ?? "";
    case "documentMessage":
      return content.documentMessage?.caption ?? "";
    case "contactMessage":
      return content.contactMessage?.vcard ?? "";
    case "contactsArrayMessage":
      return (content.contactsArrayMessage?.contacts ?? []).map((contact) => contact.vcard).join("\n");
    case "locationMessage": {
      const location = content.locationMessage;
      if (!location) {
        return "";
      }
      const maps = `https://maps.google.com/maps?q=${location.degreesLatitude}%2C${location.degreesLongitude}&z=17&hl=pt-BR`;
      const description = location.name || `${location.degreesLatitude}, ${location.degreesLongitude}`;
      return `${maps}|${description}`;
    }
    default:
      return "";
  }
}

export function quotedIdOf(content: proto.IMessage): string | undefined {
  return (
    content.extendedTextMessage?.contextInfo?.stanzaId ||
    content.imageMessage?.contextInfo?.stanzaId ||
    content.videoMessage?.contextInfo?.stanzaId ||
    content.documentMessage?.contextInfo?.stanzaId ||
    undefined
  );
}

export function shouldHandle(contentType: string | undefined, content: proto.IMessage, fromMe: boolean): boolean {
  if (!contentType || !HANDLED_TYPES.has(contentType)) {
    return false;
  }
  if (bodyOf(contentType, content).startsWith(SILENT_PREFIX)) {
    return false;
  }
  return !fromMe || hasMedia(contentType) || OWN_ALLOWED_TYPES.has(contentType);
}

export function mediaFileName(contentType: string, content: proto.IMessage, mimetype: string, now = Date.now()): string {
  const extension = (fallback: string) => mimetype.split("/")[1]?.split(";")[0] || fallback;
  switch (contentType) {
    case "imageMessage":
      return `image-${now}.${extension("jpg")}`;
    case "videoMessage":
      return `video-${now}.${extension("mp4")}`;
    case "audioMessage":
      return `audio-${now}.ogg`;
    case "documentMessage":
      return content.documentMessage?.fileName || content.documentMessage?.title || `document-${now}.${extension("bin")}`;
    case "stickerMessage":
      return `sticker-${now}.webp`;
    default:
      return `file-${now}`;
  }
}

type LooseRecord = Record<string, unknown>;

function stringField(source: LooseRecord | undefined, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = source?.[name];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export interface ResolvedIdentity {
  jid: string;
  number: string;
  lid?: string;
}

export function resolveIdentity(jid: string, key: LooseRecord, content: proto.IMessage): ResolvedIdentity {
  const context = (content.extendedTextMessage?.contextInfo ||
    content.imageMessage?.contextInfo ||
    content.videoMessage?.contextInfo ||
    content.documentMessage?.contextInfo ||
    content.audioMessage?.contextInfo ||
    content.stickerMessage?.contextInfo ||
    undefined) as LooseRecord | undefined;

  const pnFields = ["senderPn", "sender_pn", "participantPn", "participant_pn", "peerRecipientPn", "peer_recipient_pn"];
  const lidFields = ["senderLid", "sender_lid", "participantLid", "participant_lid", "recipientLid", "recipient_lid"];

  const lidCandidates = [
    ...lidFields.map((name) => stringField(key, name)),
    ...lidFields.map((name) => stringField(context, name)),
    ...pnFields.map((name) => stringField(key, name)).filter((value) => value?.includes("@lid"))
  ];
  const lidJid = jid.endsWith("@lid") ? jid : lidCandidates.find((value) => value?.includes("@lid"));
  const phoneJid = pnFields.map((name) => stringField(key, name)).find((value) => value && /@s\.whatsapp\.net$/i.test(value));

  let resolved = jid;
  if ((resolved.endsWith("@lid") || (!resolved.endsWith("@s.whatsapp.net") && !resolved.endsWith("@g.us"))) && phoneJid) {
    resolved = phoneJid;
  }

  const user = (value: string | undefined) => value?.split("@")[0]?.split(":")[0] ?? "";
  const number = resolved.endsWith("@lid") ? user(phoneJid) || user(resolved) : user(resolved);
  const lid = resolved.endsWith("@lid") ? `${user(resolved)}@lid` : lidJid ? `${user(lidJid)}@lid` : undefined;

  return { jid: resolved, number, lid };
}
