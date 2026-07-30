import { Op } from "sequelize";

import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Queue from "../../models/Queue";
import { GetSettingBoolean } from "../../helpers/GetSetting";
import { logger } from "../../utils/logger";

interface Candidate {
  user: User;
  openTickets: number;
  lastAssignedAt: number;
}

/**
 * Distribuição automática de chats entre atendentes.
 *
 * Regras, nesta ordem:
 * 1. Só roda se a configuração `autoAssignTickets` estiver habilitada.
 * 2. Candidatos = usuários da empresa, online, que pertencem à fila do ticket
 *    (ou qualquer usuário online da empresa, se o ticket não tem fila).
 * 3. Descarta quem já atingiu `maxSimultaneousTickets` (0 = ilimitado).
 * 4. Escolhe quem tem menos chats abertos; empate resolve pelo atendente que
 *    recebeu um chat há mais tempo (rodízio real, não sempre o mesmo).
 *
 * Retorna o ticket atualizado, ou o próprio ticket inalterado se não houver
 * ninguém disponível — nesse caso ele permanece pendente na fila, como antes.
 */
const AutoAssignTicketService = async (ticket: Ticket): Promise<Ticket> => {
  if (ticket.userId) return ticket;
  if (ticket.isGroup) return ticket;

  const enabled = await GetSettingBoolean(
    "autoAssignTickets",
    ticket.companyId,
    false
  );

  if (!enabled) return ticket;

  const userInclude = ticket.queueId
    ? [
        {
          model: Queue,
          as: "queues",
          where: { id: ticket.queueId },
          required: true,
          attributes: ["id"]
        }
      ]
    : [];

  const candidates = await User.findAll({
    where: {
      companyId: ticket.companyId,
      online: true
    },
    include: userInclude
  });

  if (candidates.length === 0) {
    logger.info(
      `AutoAssign: nenhum atendente online para o ticket ${ticket.id}.`
    );
    return ticket;
  }

  const scored: Candidate[] = [];

  for (const user of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const openTickets = await Ticket.count({
      where: {
        userId: user.id,
        companyId: ticket.companyId,
        status: { [Op.in]: ["open", "pending"] }
      }
    });

    const limit = user.maxSimultaneousTickets || 0;
    if (limit > 0 && openTickets >= limit) continue;

    // eslint-disable-next-line no-await-in-loop
    const lastAssigned = await Ticket.findOne({
      where: { userId: user.id, companyId: ticket.companyId },
      order: [["updatedAt", "DESC"]],
      attributes: ["updatedAt"]
    });

    scored.push({
      user,
      openTickets,
      lastAssignedAt: lastAssigned
        ? new Date(lastAssigned.updatedAt).getTime()
        : 0
    });
  }

  if (scored.length === 0) {
    logger.info(
      `AutoAssign: todos os atendentes atingiram o limite para o ticket ${ticket.id}.`
    );
    return ticket;
  }

  scored.sort((a, b) => {
    if (a.openTickets !== b.openTickets) return a.openTickets - b.openTickets;
    return a.lastAssignedAt - b.lastAssignedAt;
  });

  const chosen = scored[0].user;

  await ticket.update({ userId: chosen.id, status: "open" });
  await ticket.reload();

  logger.info(
    `AutoAssign: ticket ${ticket.id} atribuído a ${chosen.name} (${scored[0].openTickets} chats abertos).`
  );

  return ticket;
};

export default AutoAssignTicketService;
