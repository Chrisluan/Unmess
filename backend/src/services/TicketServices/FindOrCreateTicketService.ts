import { subHours } from "date-fns";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";
import GetDefaultQueue from "../../helpers/GetDefaultQueue";
import AutoAssignTicketService from "./AutoAssignTicketService";
import { GetSettingNumber } from "../../helpers/GetSetting";
import { ensureProtocol } from "../../helpers/BuildTicketProtocol";

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  groupContact?: Contact
): Promise<Ticket> => {
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
    await ticket.update({ unreadMessages });
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
      await ticket.update({
        status: "pending",
        userId: null,
        unreadMessages
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
      await ticket.update({
        status: "pending",
        userId: null,
        unreadMessages
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
      unreadMessages,
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
