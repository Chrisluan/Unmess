import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";

const pad = (value: number, size: number): string =>
  String(value).padStart(size, "0");

/**
 * Protocolo no formato AAAAMMDD + id com 6 dígitos (ex: 20260729000482).
 *
 * Derivar do id em vez de manter um contador separado garante unicidade sem
 * precisar de lock — o id já é sequencial e único.
 */
export const buildProtocol = (ticket: Ticket): string => {
  const date = ticket.createdAt ? new Date(ticket.createdAt) : new Date();

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1, 2);
  const dd = pad(date.getDate(), 2);

  return `${yyyy}${mm}${dd}${pad(ticket.id, 6)}`;
};

/**
 * Garante que o ticket tenha protocolo. Idempotente: se já existir, não mexe.
 * Chamado na criação e como rede de segurança na exibição.
 */
export const ensureProtocol = async (ticket: Ticket): Promise<Ticket> => {
  if (ticket.protocol) return ticket;

  try {
    await ticket.update({ protocol: buildProtocol(ticket) });
  } catch (error) {
    logger.error(`Error setting protocol for ticket ${ticket.id}: ${error}`);
  }

  return ticket;
};

export default ensureProtocol;
