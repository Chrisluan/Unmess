import { subHours } from "date-fns";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import GetDefaultQueue from "../../helpers/GetDefaultQueue";
import AutoAssignTicketService from "./AutoAssignTicketService";
import { GetSettingNumber } from "../../helpers/GetSetting";
import { ensureProtocol } from "../../helpers/BuildTicketProtocol";

/**
 * O que esta mensagem faz com o contador de não lidas do ticket.
 *
 * - `somar`: mensagem que o cliente acabou de mandar.
 * - `zerar`: mensagem que saiu daqui (ou do celular do atendente) — se estamos
 *   respondendo, é porque lemos.
 * - `manter`: mensagem que já estava gravada e o WhatsApp reentregou. Somar de
 *   novo faria o contador anunciar mensagens que não existem.
 */
export type ContagemNaoLidas = "somar" | "zerar" | "manter";

/**
 * Quem conta as mensagens não lidas é o próprio sistema, não o provedor.
 *
 * O parâmetro daqui era o `unreadCount` do chat, e só o wwebjs sabe
 * respondê-lo: o Baileys — provedor padrão — mandava 0 fixo. Como esta função
 * gravava esse número a cada mensagem recebida, o contador do ticket nunca
 * saía de zero e a lista de conversas jamais avisava que o cliente tinha
 * respondido. Agora a regra é do sistema.
 */
const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  contagem: ContagemNaoLidas,
  groupContact?: Contact
): Promise<Ticket> => {
  // Ticket que nasce ou reabre nesta mensagem: começa em 1 se veio do
  // cliente, em 0 se fomos nós que escrevemos.
  const naoLidasIniciais = contagem === "somar" ? 1 : 0;

  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      whatsappId: whatsappId
    }
  });

  if (ticket) {
    // `increment` em vez de ler-somar-gravar: duas mensagens que chegam quase
    // juntas leriam o mesmo valor e uma anularia a contagem da outra.
    if (contagem === "zerar") {
      await ticket.update({ unreadMessages: 0 });
    } else if (contagem === "somar") {
      await ticket.increment("unreadMessages");
    }
  }

  if (!ticket && groupContact) {
    ticket = await Ticket.findOne({
      where: {
        contactId: groupContact.id,
        whatsappId: whatsappId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      // A conversa reaberta começa um atendimento novo: o motivo do
      // encerramento anterior não vale mais. Sem limpar, o próximo
      // encerramento reaproveitava o motivo antigo em silêncio, furando a
      // exigência de motivo e sujando o relatório.
      await ticket.update({
        status: "pending",
        userId: null,
        closingStatusId: null,
        unreadMessages: naoLidasIniciais
      });
    }
  }

  if (!ticket && !groupContact) {
    // Janela de reabertura configurável: dentro dela, a mensagem reabre o
    // último chat em vez de criar um novo. Antes era fixo em 2h no código.
    const reopenWindowHours = await GetSettingNumber(
      "reopenTicketWindowHours",
      contact.companyId,
      2
    );

    ticket = await Ticket.findOne({
      where: {
        updatedAt: {
          [Op.between]: [+subHours(new Date(), reopenWindowHours), +new Date()]
        },
        contactId: contact.id,
        whatsappId: whatsappId
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      // A conversa reaberta começa um atendimento novo: o motivo do
      // encerramento anterior não vale mais. Sem limpar, o próximo
      // encerramento reaproveitava o motivo antigo em silêncio, furando a
      // exigência de motivo e sujando o relatório.
      await ticket.update({
        status: "pending",
        userId: null,
        closingStatusId: null,
        unreadMessages: naoLidasIniciais
      });
    }
  }

  if (!ticket) {
    const companyId = groupContact ? groupContact.companyId : contact.companyId;
    // Nova conversa: já cai direto no setor padrão da empresa, se houver
    // um configurado, em vez de nascer órfã de setor.
    const defaultQueue = await GetDefaultQueue(companyId);

    // Conversa de pessoa conhecida nasce aberta e sem dono: fica pronta para
    // responder sem passar pela fila. "pending" a jogaria em Oportunidades e
    // exigiria aceite, que é justamente o que não faz sentido aqui.
    const conhecido = groupContact ? groupContact.isKnown : contact.isKnown;

    ticket = await Ticket.create({
      contactId: groupContact ? groupContact.id : contact.id,
      status: conhecido ? "open" : "pending",
      isGroup: !!groupContact,
      unreadMessages: naoLidasIniciais,
      whatsappId,
      queueId: defaultQueue ? defaultQueue.id : null,
      companyId
    });

    await ensureProtocol(ticket);

    // Distribuição automática: se habilitada, já entrega o chat a um
    // atendente online em vez de deixá-lo na pilha de pendentes. Conhecido
    // fica sem dono de propósito — não é demanda a distribuir.
    if (!conhecido) {
      ticket = await AutoAssignTicketService(ticket);
    }
  }

  ticket = await ShowTicketService(ticket.id);

  return ticket;
};

export default FindOrCreateTicketService;
