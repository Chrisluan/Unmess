import {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  getContentType,
  isJidGroup,
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
import type {
  DeleteMessageCommand,
  DeliveryStatus,
  EditMessageCommand,
  InboundMessage,
  Participant,
  ReadMessagesCommand,
  SendMessageCommand
} from "../contract.ts";
import { bodyOf, hasMedia, kindOf, mediaFileName, quotedIdOf, resolveIdentity, shouldHandle } from "./inbound.ts";
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
  private readonly sentByGateway = new Set<string>();
  private readonly groupSubjects = new Map<string, string>();
  private readonly pictures = new Map<string, { url?: string; expiresAt: number }>();

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
      for (const message of messages) {
        if (type !== "notify" && !(type === "append" && message.key.fromMe)) {
          continue;
        }
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
      ? ({ key: { remoteJid: chatId, id: command.quotedMessageId, fromMe: command.quotedFromMe === true }, message: { conversation: "" } } as WAMessage)
      : undefined;
    const sent = await socket.sendMessage(chatId, content, quoted ? { quoted } : undefined);
    if (!sent?.key.id) {
      throw new Error("WhatsApp did not return a message id");
    }
    this.sentByGateway.add(sent.key.id);
    if (this.sentByGateway.size > 5000) {
      this.sentByGateway.delete(this.sentByGateway.values().next().value as string);
    }
    return { messageId: sent.key.id, chatId };
  }

  async editMessage(sessionId: string, messageId: string, command: EditMessageCommand): Promise<void> {
    const socket = this.connectedSocket(sessionId);
    const chatId = toChatId(command.chatId);
    await socket.sendMessage(chatId, { text: command.text, edit: { remoteJid: chatId, id: messageId, fromMe: true } });
  }

  async deleteMessage(sessionId: string, messageId: string, command: DeleteMessageCommand): Promise<void> {
    const socket = this.connectedSocket(sessionId);
    const chatId = toChatId(command.chatId);
    await socket.sendMessage(chatId, { delete: { remoteJid: chatId, id: messageId, fromMe: command.fromMe } });
  }

  async markRead(sessionId: string, command: ReadMessagesCommand): Promise<void> {
    const socket = this.connectedSocket(sessionId);
    const chatId = toChatId(command.chatId);
    if (command.messageIds.length > 0) {
      await socket.readMessages(command.messageIds.map((id) => ({ remoteJid: chatId, id, fromMe: false })));
    }
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
    const remoteJid = message.key.remoteJid;
    const fromMe = message.key.fromMe === true;
    if (!content || !message.key.id || !remoteJid || remoteJid === "status@broadcast" || !shouldHandle(contentType, content, fromMe)) {
      return undefined;
    }

    const type = contentType as string;
    const kind = kindOf(type, content);
    const isGroup = isJidGroup(remoteJid) === true;
    const key = message.key as unknown as Record<string, unknown>;
    const ownName = socket.user?.name?.trim().toLowerCase();
    const pushName = message.pushName?.trim() && message.pushName.trim().toLowerCase() !== ownName ? message.pushName.trim() : undefined;

    const senderJid = isGroup && !fromMe && message.key.participant ? message.key.participant : remoteJid;
    const identity = resolveIdentity(senderJid, key, content);
    const group = isGroup ? await this.groupParticipant(sessionId, socket, remoteJid) : undefined;
    const sender = isGroup && fromMe
      ? group!
      : {
          jid: identity.jid,
          number: identity.number,
          lid: identity.lid,
          name: this.contactBooks.get(sessionId)?.get(jidNormalizedUser(identity.jid))?.name || pushName || identity.number || identity.lid || "",
          profilePicUrl: await this.cachedPicture(socket, identity.jid)
        };

    let media: InboundMessage["media"];
    if (hasMedia(type)) {
      const inner = content[type as keyof proto.IMessage] as { mimetype?: string | null } | undefined;
      const mimetype = inner?.mimetype || (type === "audioMessage" ? "audio/ogg; codecs=opus" : type === "stickerMessage" ? "image/webp" : "application/octet-stream");
      try {
        const data = await downloadMediaMessage(message, "buffer", {}, { logger: this.logger, reuploadRequest: socket.updateMediaMessage });
        const filename = mediaFileName(type, content, mimetype);
        media = { ref: await this.media.save(sessionId, message.key.id, mimetype.split(";")[0] ?? mimetype, data, filename), mimetype, filename };
      } catch (error) {
        this.logger.error({ err: error, messageId: message.key.id }, "error downloading media");
      }
    }

    return {
      id: message.key.id,
      chatId: remoteJid,
      from: senderJid,
      fromMe,
      fromApp: fromMe && !this.sentByGateway.has(message.key.id),
      isGroup,
      pushName,
      timestamp: Number(message.messageTimestamp ?? Math.floor(Date.now() / 1000)),
      kind,
      text: bodyOf(type, content),
      media,
      quotedMessageId: quotedIdOf(content),
      sender,
      group
    };
  }

  private async groupParticipant(sessionId: string, socket: WASocket, jid: string): Promise<Participant> {
    const number = jid.split("@")[0] ?? jid;
    let subject = this.groupSubjects.get(jid);
    if (!subject) {
      try {
        subject = (await socket.groupMetadata(jid)).subject || number;
        this.groupSubjects.set(jid, subject);
      } catch {
        subject = number;
      }
    }
    return { jid, number, name: subject, profilePicUrl: await this.cachedPicture(socket, jid) };
  }

  private async cachedPicture(socket: WASocket, jid: string): Promise<string | undefined> {
    const cached = this.pictures.get(jid);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }
    let url: string | undefined;
    try {
      url = (await socket.profilePictureUrl(jid, "image")) ?? undefined;
    } catch {
      url = undefined;
    }
    this.pictures.set(jid, { url, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
    return url;
  }
}
