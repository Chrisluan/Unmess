import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";

const ensureTicketWhatsapp = async (ticket: Ticket): Promise<number> => {
  if (ticket.whatsappId) return ticket.whatsappId;

  const whatsapp = await GetDefaultWhatsApp(
    ticket.companyId,
    ticket.userId || undefined
  );

  await ticket.update({ whatsappId: whatsapp.id });

  logger.warn(
    { ticketId: ticket.id, whatsappId: whatsapp.id },
    "Ticket sem conexão religado a uma conexão da empresa"
  );

  return whatsapp.id;
};

export default ensureTicketWhatsapp;
