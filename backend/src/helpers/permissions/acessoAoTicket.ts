import { Request } from "express";

import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UserQueue from "../../models/UserQueue";
import getCompanyId from "../GetCompanyId";
import { alcanca } from "./escopos";
import { resolverAcessoDoUsuario } from "./resolve";

/**
 * Esta conversa é de quem pediu?
 *
 * A listagem de conversas respeita fila, conexão e `tickets:viewAll`, mas
 * abrir uma conversa pelo id só conferia a empresa. Escondida na lista e
 * aberta pela URL é o formato clássico dessa falha: o filtro da tela virava
 * enfeite. Aqui a mesma regra da lista vale para cada rota que recebe um
 * `:ticketId`.
 *
 * A conta espelha o que as abas já mostram — se a lista mostra, a conversa
 * abre; se a lista esconde, abrir pelo id também falha:
 *
 *   - a conexão (número) precisa estar no escopo da pessoa;
 *   - com `tickets:viewAll`, o resto vale;
 *   - sem ele, só conversas atribuídas a si, de fila sua, sem fila, grupos e
 *     as de pessoas conhecidas (que têm aba própria para todos).
 */
export const garantirAcessoAoTicket = async (
  req: Request,
  ticketId: number | string
): Promise<void> => {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId: getCompanyId(req) },
    attributes: ["id", "userId", "queueId", "whatsappId", "isGroup"],
    include: [{ model: Contact, as: "contact", attributes: ["id", "isKnown"] }]
  });

  if (!ticket) throw new AppError("ERR_NO_TICKET_FOUND", 404);

  const userId = Number(req.user.id);
  const acesso = await resolverAcessoDoUsuario(userId);

  if (acesso.isSuper) return;

  if (!alcanca(acesso.scopes.connection, ticket.whatsappId)) {
    throw new AppError(
      "Esta conversa é de uma conexão que não está no seu acesso. Peça a " +
        "quem administra o sistema para incluí-la.",
      403
    );
  }

  if (acesso.permissions.includes("tickets:viewAll")) return;

  if (ticket.userId === userId) return;
  if (ticket.queueId === null || ticket.queueId === undefined) return;
  if (ticket.isGroup || ticket.contact?.isKnown) return;

  const filas = await UserQueue.findAll({
    where: { userId },
    attributes: ["queueId"]
  });

  if (!filas.some(f => f.queueId === ticket.queueId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

/** O mesmo, para rotas que recebem o id da mensagem. */
export const garantirAcessoAoTicketDaMensagem = async (
  req: Request,
  messageId: string
): Promise<void> => {
  const mensagem = await Message.findByPk(messageId, {
    attributes: ["id", "ticketId"]
  });

  if (!mensagem) return; // o handler responde com a mensagem certa

  await garantirAcessoAoTicket(req, mensagem.ticketId);
};
