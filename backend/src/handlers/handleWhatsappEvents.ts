import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import crypto from "crypto";
import * as Sentry from "@sentry/node";

import { getIO } from "../libs/socket";
import { companyRoom, ticketRoom } from "../libs/socketRooms";
import { logger } from "../utils/logger";
import { debounce } from "../helpers/Debounce";
import formatBody from "../helpers/Mustache";

import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message from "../models/Message";

import CreateMessageService from "../services/MessageServices/CreateMessageService";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService, {
  ContagemNaoLidas
} from "../services/TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CreateContactService from "../services/ContactServices/CreateContactService";

import { whatsappProvider } from "../providers/WhatsApp/whatsappProvider";
import { MessageType, MessageAck } from "../providers/WhatsApp/types";
import IsWithinBusinessHours from "../helpers/IsWithinBusinessHours";
import { ROTULO_AUDIO } from "../helpers/RotuloAudio";
import Setting from "../models/Setting";
import { GetSettingBoolean } from "../helpers/GetSetting";
import chatIdDoContato from "../helpers/ChatIdDoContato";

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

/**
 * Sufixo aleatório do nome dos anexos.
 *
 * Usa crypto, e não Math.random: o nome é a única coisa que separa o anexo de
 * uma conversa de quem quiser baixá-lo, porque /public responde sem pedir
 * login. Math.random é previsível a partir do estado interno do gerador e
 * oferecia 5 caracteres de proteção; aqui a aleatoriedade é criptográfica e o
 * comprimento pedido é respeitado.
 */
const makeRandomId = (length: number): string =>
  crypto
    .randomBytes(Math.ceil((length * 3) / 4))
    .toString("base64")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, length);

const processLocationMessage = (
  messagePayload: MessagePayload
): MessagePayload => {
  if (messagePayload.type !== "location") return messagePayload;

  return messagePayload;
};

const saveMediaFile = async (mediaPayload: MediaPayload): Promise<string> => {
  // 24 caracteres, e não os 5 de antes: como /public entrega o anexo a quem
  // souber o nome, sem pedir login, é este trecho aleatório que separa a
  // conversa de um cliente do resto da internet. Com 5 caracteres a busca era
  // grande mas alcançável; com 24 deixa de ser.
  const randomId = makeRandomId(24);
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
            chatIdDoContato(contactPayload, false),
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
      chatIdDoContato(contactPayload, contactPayload.isGroup),
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

    // Reentrega da mesma mensagem (reconexão, fila offline do WhatsApp) não
    // pode somar de novo: o contador passaria a anunciar mensagens que o
    // cliente nunca mandou. O id vem do próprio WhatsApp, então é a chave.
    const jaGravada = await Message.findByPk(processedMessage.id, {
      attributes: ["id"]
    });

    let contagemNaoLidas: ContagemNaoLidas = "somar";
    if (processedMessage.fromMe) contagemNaoLidas = "zerar";
    else if (jaGravada) contagemNaoLidas = "manter";

    const ticket = await FindOrCreateTicketService(
      contact,
      contextPayload.whatsappId,
      contagemNaoLidas,
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
      // Pelo helper, como o resto do sistema: comparar "enabled" direto
      // tratava um "true" gravado por outra tela como desligado.
      if (await GetSettingBoolean("outOfHoursMessageEnabled", companyId, false)) {
        const isOpen = await IsWithinBusinessHours(companyId);

        if (!isOpen) {
          const messageSetting = await Setting.findOne({
            where: { key: "outOfHoursMessage", companyId }
          });

          if (messageSetting?.value) {
            try {
              await whatsappProvider.sendMessage(
                contextPayload.whatsappId,
                chatIdDoContato(contactPayload, contactPayload.isGroup),
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
      const [mediaType] = mediaPayload.mimetype.split("/");

      // Figurinha chega como "image/webp", e derivar o tipo do mimetype
      // apagava justamente o que a distingue de uma foto: a conversa gravava
      // "image" e a tela mostrava um botão de download no lugar do desenho.
      // O tipo que veio do provedor sabe a diferença e tem a palavra final.
      messageData.mediaType =
        processedMessage.type === "sticker" ? "sticker" : mediaType;

      // saveMediaFile insere um sufixo aleatório para os arquivos não
      // colidirem em disco. Na conversa deve aparecer o nome original, não o
      // nome de armazenamento.
      //
      // Figurinha e áudio são a exceção: nenhum dos dois tem nome que
      // interesse a alguém, e guardar o do arquivo fazia a conversa exibir
      // "sticker-1786938287793.webp" embaixo do desenho, ou "1756938287793
      // .ogg" embaixo do player -- e esse mesmo texto virava a prévia na
      // lista de conversas.
      const semNomeParaMostrar =
        processedMessage.type === "sticker" ||
        messageData.mediaType === "audio";

      messageData.body = semNomeParaMostrar
        ? processedMessage.body || ""
        : processedMessage.body || mediaPayload.filename || filename;
    }

    let lastMessageText = "";
    if (processedMessage.type === "location") {
      lastMessageText = processedMessage.body.includes("Localization")
        ? processedMessage.body
        : "Localization";
    } else if (
      messageData.mediaType === "audio" ||
      messageData.mediaType === "ptt"
    ) {
      // Idem na lista de conversas: o nome do arquivo de áudio não diz nada a
      // quem lê a prévia, e é justamente o texto que não deve ficar gravado.
      lastMessageText = ROTULO_AUDIO;
    } else {
      lastMessageText = processedMessage.body || mediaPayload?.filename || "";
    }

    // lastMessageAt vem do WhatsApp, não do relógio do servidor: é o mesmo
    // horário exibido dentro da conversa, então lista e conversa concordam.
    await ticket.update({
      lastMessage: lastMessageText,
      lastMessageAt: messageData.timestamp || new Date(),
      lastMessageFromMe: processedMessage.fromMe
    });

    // A mensagem citada pode não existir por aqui: o contato respondeu a algo
    // de antes de o número ser conectado, ou a uma mensagem já apagada.
    // Gravar o id assim mesmo violava a chave estrangeira e derrubava a
    // gravação inteira — o cliente escrevia e nada aparecia na conversa. A
    // citação some, a mensagem fica.
    if (messageData.quotedMsgId) {
      const citada = await Message.findByPk(messageData.quotedMsgId, {
        attributes: ["id"]
      });

      if (!citada) {
        logger.warn(
          {
            messageId: messageData.id,
            quotedMsgId: messageData.quotedMsgId,
            ticketId: ticket.id
          },
          "Mensagem citada desconhecida; a citação foi ignorada"
        );
        messageData.quotedMsgId = undefined;
      }
    }

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

/**
 * Localiza a mensagem para aplicar a confirmação.
 *
 * O WhatsApp costuma confirmar o envio antes de o eco da própria mensagem
 * chegar e ser gravado, então a primeira busca falha com frequência. Antes
 * havia uma pausa fixa de meio segundo e uma única tentativa: quando o eco
 * demorava mais que isso, a confirmação era perdida em silêncio e a mensagem
 * ficava parada em "enviando" para sempre.
 */
const aguardarMensagem = async (messageId: string): Promise<Message | null> => {
  const tentativas = [0, 500, 1500, 3000];

  for (let i = 0; i < tentativas.length; i += 1) {
    if (tentativas[i] > 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, tentativas[i]));
    }

    // eslint-disable-next-line no-await-in-loop
    const mensagem = await Message.findByPk(messageId, {
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

    if (mensagem) return mensagem;
  }

  return null;
};

export const handleMessageAck = async (
  messageId: string,
  ack: MessageAck
): Promise<void> => {
  const io = getIO();

  try {
    const messageToUpdate = await aguardarMensagem(messageId);

    if (!messageToUpdate) {
      logger.warn(
        { messageId, ack },
        "Confirmação recebida para mensagem desconhecida"
      );
      return;
    }

    const atual = messageToUpdate.ack ?? 0;

    // Os estados só avançam. O WhatsApp reenvia confirmações fora de ordem —
    // o recibo de entrega chega depois do de leitura com alguma frequência —
    // e gravar o número cru fazia a mensagem voltar de "lida" para "entregue"
    // na tela do atendente.
    //
    // A falha é a exceção: ela vale enquanto o servidor não tiver confirmado
    // nada, e nunca depois, para não apagar um envio que deu certo.
    const avanca = ack > atual;
    const falhaValida = ack === -1 && atual < 1;

    if (!avanca && !falhaValida) {
      return;
    }

    await messageToUpdate.update({ ack });

    if (ack === -1) {
      logger.error(
        {
          messageId,
          ticketId: messageToUpdate.ticketId,
          body: messageToUpdate.body?.slice(0, 120)
        },
        "WhatsApp recusou a mensagem"
      );
    }

    io.to(companyRoom(messageToUpdate.ticket.companyId))
      .to(
        ticketRoom(messageToUpdate.ticket.companyId, messageToUpdate.ticketId)
      )
      .emit("appMessage", {
        action: "update",
        message: messageToUpdate
      });
  } catch (err) {
    Sentry.captureException(err);
    logger.error({ err, messageId, ack }, "Error handling message ack");
  }
};
