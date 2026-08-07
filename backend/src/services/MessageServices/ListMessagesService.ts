import { Op, WhereOptions, fn, col } from "sequelize";

import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import ShowTicketService from "../TicketServices/ShowTicketService";

interface Request {
  ticketId: string;
  pageNumber?: string;
  /** Busca dentro do histórico desta conversa. */
  searchParam?: string;
  companyId: number;
}

interface Response {
  messages: Message[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId,
  searchParam,
  companyId
}: Request): Promise<Response> => {
  const ticket = await ShowTicketService(ticketId, companyId);

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  // await setMessagesAsRead(ticket);
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  let where: WhereOptions = { ticketId };

  if (searchParam && searchParam.trim()) {
    where = { ticketId, body: { [Op.like]: `%${searchParam.trim()}%` } };
  }

  const { count, rows: messages } = await Message.findAndCountAll({
    where,
    limit,
    include: [
      "contact",
      { model: User, as: "user", attributes: ["id", "name"] },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ],
    offset,
    // Ordena pelo horário real de envio, caindo em createdAt nas linhas
    // anteriores à coluna. Ordenar só por createdAt jogava a mensagem que
    // demorou a chegar para o fim da conversa, fora da sequência do diálogo.
    //
    // As duas colunas precisam do prefixo da tabela: quotedMsg é um join da
    // própria Messages, então "timestamp" sozinho fica ambíguo e o MySQL
    // recusa a consulta.
    order: [
      [
        fn("COALESCE", col("Message.timestamp"), col("Message.createdAt")),
        "DESC"
      ]
    ]
  });

  const hasMore = count > offset + messages.length;

  return {
    messages: messages.reverse(),
    ticket,
    count,
    hasMore
  };
};

export default ListMessagesService;
