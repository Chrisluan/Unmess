import {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  getContentType,
  isJidUser,
  jidNormalizedUser,
  makeWASocket,
  normalizeMessageContent,
  proto,
  type AnyMessageContent,
  type Contact,
  type WAMessage,
  type WASocket
} from "baileys";
import type { DeliveryStatus, InboundMessage, MessageKind, SendMessageCommand } from "../contract.ts";
import type { Logger } from "../logger.ts";
import type { MediaStore } from "../media.ts";
import type { SecretStore } from "../storage/secretStore.ts";
import { SessionUnavailableError, type AdapterListener, type NumberCheck, type PhoneContact, type WhatsappAdapter } from "./adapter.ts";
import { useEncryptedAuthState } from "./baileysAuthState.ts";
import { toChatId } from "./fakeAdapter.ts";

const STATUS_MAP: Partial<Record<number, DeliveryStatus>> = {
  [proto.WebMessageInfo.Status.ERROR]: "failed",
  [proto.WebMessageInfo.Status.PENDING]: "pending",
  [proto.WebMessageInfo.Status.SERVER_ACK]: "sent",
  [proto.WebMessageInfo.Status.DELIVERY_ACK]: "delivered",
  [proto.WebMessageInfo.Status.READ]: "read",
  [proto.WebMessageInfo.Status.PLAYED]: "played"
};

export interface BaileysAdapterOptions {
  syncFullHistory: boolean;
}

export class BaileysAdapter implements WhatsappAdapter {
  private readonly store: SecretStore;
  private readonly media: MediaStore;
  private readonly logger: Logger;
  private readonly options: BaileysAdapterOptions;
  private readonly sockets = new Map<string, WASocket>();
  private readonly intentionalClose = new Map<string, boolean>();
  private readonly contactBooks = new Map<string, Map<string, PhoneContact>>();

  constructor(store: SecretStore, media: MediaStore, logger: Logger, options: BaileysAdapterOptions) {
    this.store = store;
    this.media = media;
    this.logger = logger;
    this.options = options;
  }

  async connect(sessionId: string, listener: AdapterListener): Promise<void> {
    this.sockets.get(sessionId)?.end(undefined);
    const { state, saveCreds } = useEncryptedAuthState(this.store, sessionId);
    const socketLogger = this.logger.child({ sessionId, component: "baileys" });
    socketLogger.level = "warn";

    const socket = makeWASocket({
      auth: state,
      logger: socketLogger,
      browser: Browsers.ubuntu("Unmess"),
      markOnlineOnConnect: false,
      syncFullHistory: this.options.syncFullHistory,
      shouldSyncHistoryMessage: () => this.options.syncFullHistory,
      generateHighQualityLinkPreview: false
    });
    this.sockets.set(sessionId, socket);
    listener.onConnection(sessionId, { state: "connecting" });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
      if (update.qr) {
        listener.onConnection(sessionId, { state: "qr", qr: update.qr });
      }

      if (update.connection === "open") {
        const phoneNumber = socket.user?.id ? jidNormalizedUser(socket.user.id).split("@")[0] : undefined;
        listener.onConnection(sessionId, { state: "open", phoneNumber });
      }

      if (update.connection === "close") {
        if (this.sockets.get(sessionId) === socket) {
          this.sockets.delete(sessionId);
        }
        const intentional = this.intentionalClose.get(sessionId);
        this.intentionalClose.delete(sessionId);
        const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        const loggedOut = intentional === true || statusCode === DisconnectReason.loggedOut;
        if (loggedOut) {
          this.store.clear(sessionId);
        }
        listener.onConnection(sessionId, {
          state: "closed",
          reason: intentional !== undefined ? "disconnected" : `status_${statusCode ?? "unknown"}`,
          loggedOut
        });
      }
    });

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") {
        return;
      }
      for (const message of messages) {
        try {
          const normalized = await this.normalize(sessionId, socket, message);
          if (normalized) {
            listener.onMessage(sessionId, normalized);
          }
        } catch (error) {
          socketLogger.error({ err: error, messageId: message.key.id }, "failed to normalize inbound message");
        }
      }
    });

    const phoneContacts = new Map<string, PhoneContact>();
    this.contactBooks.set(sessionId, phoneContacts);
    const rememberContacts = (contacts: Partial<Contact>[]) => {
      for (const contact of contacts) {
        if (!contact.id || !isJidUser(contact.id)) {
          continue;
        }
        const jid = jidNormalizedUser(contact.id);
        const previous = phoneContacts.get(jid);
        phoneContacts.set(jid, {
          jid,
          number: jid.split("@")[0] ?? jid,
          name: contact.name ?? previous?.name,
          pushName: contact.notify ?? previous?.pushName
        });
      }
    };
    socket.ev.on("contacts.upsert", rememberContacts);
    socket.ev.on("contacts.update", rememberContacts);

    socket.ev.on("messages.update", (updates) => {
      for (const { key, update } of updates) {
        const status = update.status !== undefined && update.status !== null ? STATUS_MAP[update.status] : undefined;
        if (status && key.id && key.remoteJid && key.fromMe) {
          listener.onStatus(sessionId, key.id, key.remoteJid, status);
        }
      }
    });
  }

  async disconnect(sessionId: string, logout: boolean): Promise<void> {
    const socket = this.sockets.get(sessionId);
    if (!socket) {
      if (logout) {
        this.store.clear(sessionId);
      }
      return;
    }

    this.intentionalClose.set(sessionId, logout);
    if (logout) {
      await socket.logout().catch((error: unknown) => this.logger.warn({ err: error, sessionId }, "logout failed"));
    } else {
      socket.end(undefined);
    }
  }

  async send(sessionId: string, command: SendMessageCommand): Promise<{ messageId: string; chatId: string }> {
    const socket = this.sockets.get(sessionId);
    if (!socket?.user) {
      throw new Error("session is not connected");
    }

    const chatId = toChatId(command.to);
    const content = await this.buildContent(command);
    const quoted = command.quotedMessageId
      ? ({ key: { remoteJid: chatId, id: command.quotedMessageId, fromMe: false }, message: { conversation: "" } } as WAMessage)
      : undefined;
    const sent = await socket.sendMessage(chatId, content, quoted ? { quoted } : undefined);
    if (!sent?.key.id) {
      throw new Error("WhatsApp did not return a message id");
    }
    return { messageId: sent.key.id, chatId };
  }

  async checkNumber(sessionId: string, number: string): Promise<NumberCheck> {
    const socket = this.connectedSocket(sessionId);
    const [result] = (await socket.onWhatsApp(number.replace(/\D/g, ""))) ?? [];
    return result?.exists ? { exists: true, jid: jidNormalizedUser(result.jid) } : { exists: false };
  }

  async profilePictureUrl(sessionId: string, jid: string): Promise<string | undefined> {
    const socket = this.connectedSocket(sessionId);
    try {
      return (await socket.profilePictureUrl(toChatId(jid), "image")) ?? undefined;
    } catch {
      return undefined;
    }
  }

  async contacts(sessionId: string): Promise<PhoneContact[]> {
    this.connectedSocket(sessionId);
    return [...(this.contactBooks.get(sessionId)?.values() ?? [])];
  }

  async shutdown(): Promise<void> {
    for (const [sessionId, socket] of this.sockets) {
      this.intentionalClose.set(sessionId, false);
      socket.end(undefined);
    }
    this.sockets.clear();
  }

  private connectedSocket(sessionId: string): WASocket {
    const socket = this.sockets.get(sessionId);
    if (!socket?.user) {
      throw new SessionUnavailableError("session is not connected");
    }
    return socket;
  }

  private async buildContent(command: SendMessageCommand): Promise<AnyMessageContent> {
    if (!command.media) {
      if (!command.text) {
        throw new Error("text or media is required");
      }
      return { text: command.text };
    }

    const { media } = command;
    const data = await this.media.read(media.ref);
    if (media.asSticker) {
      return { sticker: data };
    }
    if (media.asDocument || (!media.mimetype.startsWith("image/") && !media.mimetype.startsWith("video/") && !media.mimetype.startsWith("audio/"))) {
      return { document: data, mimetype: media.mimetype, fileName: media.filename ?? "arquivo", caption: media.caption };
    }
    if (media.mimetype.startsWith("image/")) {
      return { image: data, mimetype: media.mimetype, caption: media.caption };
    }
    if (media.mimetype.startsWith("video/")) {
      return { video: data, mimetype: media.mimetype, caption: media.caption };
    }
    return { audio: data, mimetype: media.mimetype, ptt: media.asVoice === true };
  }

  private async normalize(sessionId: string, socket: WASocket, message: WAMessage): Promise<InboundMessage | undefined> {
    const content = normalizeMessageContent(message.message);
    const contentType = getContentType(content);
    if (!content || !contentType || !message.key.id || !message.key.remoteJid || message.key.remoteJid === "status@broadcast") {
      return undefined;
    }
    if (contentType === "protocolMessage" || contentType === "senderKeyDistributionMessage" || contentType === "reactionMessage") {
      return undefined;
    }

    const kind = kindOf(contentType, content);
    const inner = content[contentType] as { caption?: string; mimetype?: string; fileName?: string; contextInfo?: { stanzaId?: string } } | string | undefined;
    const text = typeof inner === "string" ? inner : (content.extendedTextMessage?.text ?? (inner as { caption?: string } | undefined)?.caption ?? undefined);
    const contextInfo = typeof inner === "object" ? inner?.contextInfo : undefined;

    let media: InboundMessage["media"];
    if (["image", "video", "audio", "voice", "document", "sticker"].includes(kind) && typeof inner === "object") {
      const data = await downloadMediaMessage(message, "buffer", {}, {
        logger: this.logger,
        reuploadRequest: socket.updateMediaMessage
      });
      const mimetype = inner?.mimetype ?? "application/octet-stream";
      media = {
        ref: await this.media.save(sessionId, message.key.id, mimetype.split(";")[0] ?? mimetype, data, inner?.fileName ?? undefined),
        mimetype,
        filename: inner?.fileName ?? undefined
      };
    }

    const chatId = message.key.remoteJid;
    return {
      id: message.key.id,
      chatId,
      from: message.key.participant ?? chatId,
      fromMe: message.key.fromMe === true,
      pushName: message.pushName ?? undefined,
      timestamp: Number(message.messageTimestamp ?? Math.floor(Date.now() / 1000)),
      kind,
      text: text ?? undefined,
      media,
      quotedMessageId: contextInfo?.stanzaId ?? undefined
    };
  }
}

function kindOf(contentType: string, content: proto.IMessage): MessageKind {
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
    case "liveLocationMessage":
      return "location";
    case "contactMessage":
    case "contactsArrayMessage":
      return "contact";
    default:
      return "unknown";
  }
}
