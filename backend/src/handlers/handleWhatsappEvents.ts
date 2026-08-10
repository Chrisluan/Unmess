import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";

import { getIO } from "../libs/socket";
import { logger } from "../utils/logger";
import { debounce } from "../helpers/Debounce";
import formatBody from "../helpers/Mustache";

import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message from "../models/Message";

import CreateMessageService from "../services/MessageServices/CreateMessageService";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CreateContactService from "../services/ContactServices/CreateContactService";

import { whatsappProvider } from "../providers/WhatsApp/whatsappProvider";
import { MessageType, MessageAck } from "../providers/WhatsApp/types";
import IsWithinBusinessHours from "../helpers/IsWithinBusinessHours";
import Setting from "../models/Setting";

const writeFileAsync = promisify(writeFile);

export interface ContactPayload {
  name: string;
  number: string;
  lid?: string;
  profilePicUrl?: string;
  isGroup: boolean;
}

export interface MessagePayload {
  id: string;
  body: string;
  fromMe: boolean;
  hasMedia: boolean;
  type: MessageType;
  timestamp: number;
  from: string;
  to: string;
  hasQuotedMsg?: boolean;
  quotedMsgId?: string;
  mediaUrl?: string;
  mediaType?: string;
  ack?: MessageAck;
  /** Própria, porém enviada pelo aplicativo no celular e não por este sistema. */
  fromApp?: boolean;
}

export interface MediaPayload {
  filename: string;
  mimetype: string;
  data: string;
}

export interface WhatsappContextPayload {
  whatsappId: number;
  unreadMessages: number;
  groupContact?: ContactPayload;
}

/**
 * Converte o timestamp do WhatsApp (segundos) em Date.
 *
 * A tolerância existe porque provedores já entregaram o valor em
 * milissegundos; distinguir pela ordem de grandeza evita gravar uma data no
 * ano 57000 caso isso volte a acontecer.
 */
const toMessageDate = (timestamp?: number): Date | undefined => {
  if (!timestamp || !Number.isFinite(timestamp)) return undefined;

  const ms = timestamp > 1e11 ? timestamp : timestamp * 1000;
  const data = new Date(ms);

  return Number.isNaN(data.getTime()) ? undefined : data;
};

const makeRandomId = (length: number): string => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
};

const processLocationMessage = (
  messagePayload: MessagePayload
): MessagePayload => {
  if (messagePayload.type !== "location") return messagePayload;

  return messagePayload;
};

const saveMediaFile = async (mediaPayload: MediaPayload): Promise<string> => {
  const randomId = makeRandomId(5);
  const { filename: originalFilename } = mediaPayload;

  let filename: string;
  if (!originalFilename) {
    const [extension] = mediaPayload.mimetype.split("/")[1].split(";");
    filename = `${randomId}-${new Date().getTime()}.${extension}`;
  } else {
    const baseName = originalFilename.split(".").slice(0, -1).join(".");
    const extension = originalFilename.split(".").slice(-1)[0];
    filename = `${baseName}.${randomId}.${extension}`;
  }

  try {
    await writeFileAsync(
      join(__dirname, "..", "..", "public", filename),
      mediaPayload.data,
      "base64"
    );
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }

  return filename;
};

const processVcardMessage = async (
  messagePayload: MessagePayload,
  companyId: number
): Promise<void> => {
  if (messagePayload.type !== "vcard") return;

  try {
    const array = messagePayload.body.split("\n");
    const phoneNumbers: Array<{ number: string }> = [];
    let contactName = "";

    array.forEach(line => {
      const values = line.split(":");
      values.forEach((value, index) => {
        if (value.indexOf("+") !== -1) {
          phoneNumbers.push({ number: value });
        }
        if (value.indexOf("FN") !== -1 && values[index + 1]) {
          contactName = values[index + 1];
        }
      });
    });

    await Promise.all(
      phoneNumbers.map(({ number }) =>
        CreateContactService({
          name: contactName,
          number: number.replace(/\D/g, ""),
          companyId
        })
      )
    );
  } catch (error) {
    logger.error("Error processing vcard message:", error);
  }
};

const handleQueueLogic = async (
  whatsappId: number,
  messageBody: string,
  ticket: Ticket,
  contactPayload: ContactPayload
): Promise<void> => {
  const { queues, greetingMessage } = await ShowWhatsAppService(whatsappId);

  if (queues.length === 1) {
    await UpdateTicketService({
      ticketData: { queueId: queues[0].id },
      ticketId: ticket.id
    });
    return;
  }

  // Setor padrão: quando o admin marca uma fila como padrão, o atendimento
  // cai direto nela, sem exigir que o cliente escolha uma opção no menu.
  const defaultQueue = queues.find(queue => queue.isDefault);
  if (defaultQueue) {
    await UpdateTicketService({
      ticketData: { queueId: defaultQueue.id },
      ticketId: ticket.id
    });
    return;
  }

  const selectedOption = messageBody;
  const choosenQueue = queues[+selectedOption - 1];

  if (choosenQueue) {
    // A sauda\u00e7\u00e3o do setor escolhido sai por sendQueueGreeting, no fim do
    // handleMessage \u2014 envi\u00e1-la aqui tamb\u00e9m mandaria a mensagem duas vezes.
    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id },
      ticketId: ticket.id
    });
  } else {
    let options = "";
    queues.forEach((queue, index) => {
      options += `*${index + 1}* - ${queue.name}\n`;
    });

    const body = formatBody(
      `\u200e${greetingMessage}\n${options}`,
      contactPayload as any
    );

    const debouncedSentMessage = debounce(
      async () => {
        try {
          await whatsappProvider.sendMessage(
            whatsappId,
            `${contactPayload.number}@c.us`,
            body
          );
        } catch (error) {
          logger.error("Error sending queue options message:", error);
        }
      },
      3000,
      ticket.id
    );

    debouncedSentMessage();
  }
};

/**
 * Envia a mensagem de saudação do setor em que a conversa caiu, uma única vez.
 *
 * Fica fora do handleQueueLogic de propósito: aquele só roda para conversa sem
 * setor, e desde que o ticket passou a nascer no setor padrão isso deixou de
 * acontecer. Também não depende da associação entre conexão e setor — o
 * atendente configura a saudação no setor e espera que ela valha, sem precisar
 * amarrar setor a cada número.
 */
const sendQueueGreeting = async (
  ticketId: number,
  contactPayload: ContactPayload,
  whatsappId: number
): Promise<void> => {
  const ticket = await Ticket.findByPk(ticketId, { include: ["queue"] });

  if (!ticket || ticket.greetingSent || !ticket.queue) return;

  const saudacao = ticket.queue.greetingMessage?.trim();

  // Marca antes de enviar: uma falha no envio não deve fazer o cliente receber
  // a saudação repetida a cada nova mensagem dele.
  await ticket.update({ greetingSent: true });

  if (!saudacao) return;

  try {
    await whatsappProvider.sendMessage(
      whatsappId,
      `${contactPayload.number}@${contactPayload.isGroup ? "g" : "c"}.us`,
      // O ‎ marca a mensagem como enviada pelo sistema, para o handler
      // não reprocessá-la ao vê-la voltar.
      formatBody(`‎${saudacao}`, ticket)
    );
  } catch (error) {
    logger.error({ info: "Error sending queue greeting", ticketId, error });
  }
};

export const handleMessage = async (
  messagePayload: MessagePayload,
  contactPayload: ContactPayload,
  contextPayload: WhatsappContextPayload,
  mediaPayload?: MediaPayload
): Promise<void> => {
  try {
    const processedMessage = processLocationMessage(messagePayload);

    const whatsapp = await ShowWhatsAppService(contextPayload.whatsappId);
    const { companyId } = whatsapp;

    const contact = await CreateOrUpdateContactService({
      name: contactPayload.name,
      number: contactPayload.number,
      lid: contactPayload.lid,
      profilePicUrl: contactPayload.profilePicUrl,
      isGroup: contactPayload.isGroup,
      companyId
    });

    let groupContact: Contact | undefined;
    if (contextPayload.groupContact) {
      groupContact = await CreateOrUpdateContactService({
        name: contextPayload.groupContact.name,
        number: contextPayload.groupContact.number,
        lid: contextPayload.groupContact.lid,
        profilePicUrl: contextPayload.groupContact.profilePicUrl,
        isGroup: contextPayload.groupContact.isGroup,
        companyId
      });
    }

    if (
      contextPayload.unreadMessages === 0 &&
      whatsapp.farewellMessage &&
      formatBody(whatsapp.farewellMessage, contact) === processedMessage.body
    ) {
      return;
    }


    const ticket = await FindOrCreateTicketService(
      contact,
      contextPayload.whatsappId,
      contextPayload.unreadMessages,
      groupContact
    );

    // Mensagem automática de fora do expediente: dispara só na primeira
    // mensagem não lida do ticket (evita floodar o cliente a cada mensagem)
    // e só quando a empresa configurou e habilitou essa automação.
    if (
      !processedMessage.fromMe &&
      contextPayload.unreadMessages === 1 &&
      processedMessage.type !== "vcard"
    ) {
      const outOfHoursSetting = await Setting.findOne({
        where: { key: "outOfHoursMessageEnabled", companyId }
      });

      if (outOfHoursSetting?.value === "enabled") {
        const isOpen = await IsWithinBusinessHours(companyId);

        if (!isOpen) {
          const messageSetting = await Setting.findOne({
            where: { key: "outOfHoursMessage", companyId }
          });

          if (messageSetting?.value) {
            try {
              await whatsappProvider.sendMessage(
                contextPayload.whatsappId,
                `${contactPayload.number}@${contactPayload.isGroup ? "g" : "c"}.us`,
                formatBody(`\u200e${messageSetting.value}`, ticket)
              );
            } catch (error) {
              logger.error("Error sending out-of-hours message:", error);
            }
          }
        }
      }
    }

    const messageData: any = {
      id: processedMessage.id,
      ticketId: ticket.id,
      contactId: processedMessage.fromMe ? undefined : contact.id,
      body: processedMessage.body,
      fromMe: processedMessage.fromMe,
      read: processedMessage.fromMe,
      mediaType: processedMessage.type,
      quotedMsgId: processedMessage.quotedMsgId,
      ack: processedMessage.ack !== undefined ? processedMessage.ack : 0,
      fromApp: Boolean(processedMessage.fromApp),
      timestamp: toMessageDate(processedMessage.timestamp)
    };

    if (mediaPayload && processedMessage.hasMedia) {
      const filename = await saveMediaFile(mediaPayload);
      messageData.mediaUrl = filename;
      // saveMediaFile insere um sufixo aleatório para os arquivos não
      // colidirem em disco. Na conversa deve aparecer o nome original, não o
      // nome de armazenamento.
      messageData.body =
        processedMessage.body || mediaPayload.filename || filename;
      const [mediaType] = mediaPayload.mimetype.split("/");
      messageData.mediaType = mediaType;
    }

    let lastMessageText = "";
    if (processedMessage.type === "location") {
      lastMessageText = processedMessage.body.includes("Localization")
        ? processedMessage.body
        : "Localization";
    } else {
      lastMessageText = processedMessage.body || mediaPayload?.filename || "";
    }

    // lastMessageAt vem do WhatsApp, não do relógio do servidor: é o mesmo
    // horário exibido dentro da conversa, então lista e conversa concordam.
    await ticket.update({
      lastMessage: lastMessageText,
      lastMessageAt: messageData.timestamp || new Date()
    });

    await CreateMessageService({ messageData });

    await processVcardMessage(processedMessage, ticket.companyId);

    if (
      !ticket.queue &&
      !contextPayload.groupContact &&
      !processedMessage.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1
    ) {
      await handleQueueLogic(
        contextPayload.whatsappId,
        processedMessage.body,
        ticket,
        contactPayload
      );
    }

    // Depois do roteamento, porque handleQueueLogic pode ter acabado de
    // definir o setor. Só para mensagem recebida: responder à própria
    // saudação, ou saudar um grupo, não faz sentido.
    if (!processedMessage.fromMe && !contextPayload.groupContact) {
      await sendQueueGreeting(
        ticket.id,
        contactPayload,
        contextPayload.whatsappId
      );
    }
  } catch (err) {
    Sentry.captureException(err);
    logger.error({
      info: "Error handling message",
      err,
      messagePayload,
      contactPayload,
      contextPayload,
      mediaPayload
    });
  }
};

export const handleMessageAck = async (
  messageId: string,
  ack: MessageAck
): Promise<void> => {
  await new Promise(r => setTimeout(r, 500));

  const io = getIO();

  try {
    const messageToUpdate = await Message.findByPk(messageId, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        },
        {
          model: Ticket,
          as: "ticket",
          attributes: ["id", "companyId"]
        }
      ]
    });

    if (!messageToUpdate) {
      return;
    }

    await messageToUpdate.update({ ack });

    io.to(`company-${messageToUpdate.ticket.companyId}`)
      .to(messageToUpdate.ticketId.toString())
      .emit("appMessage", {
        action: "update",
        message: messageToUpdate
      });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`Error handling message ack: ${err}`);
  }
};
