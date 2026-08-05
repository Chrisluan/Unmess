import { Op, fn, where, col, Filterable, Includeable } from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import ShowUserService from "../UserServices/ShowUserService";
import Whatsapp from "../../models/Whatsapp";
import Tag from "../../models/Tag";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  tab?: string; // "myTickets" | "attending" | "waiting" | "groups" | undefined (usa status normal, ex: closed)
  date?: string;
  showAll?: string;
  userId: string;
  withUnreadMessages?: string;
  queueIds: number[];
  /** Filtro por conexão (número de WhatsApp). Vazio = todas. */
  whatsappIds?: number[];
  /** Filtro por etiqueta. Vazio = todas. */
  tagIds?: number[];
  /** "only" = só grupos, "exclude" = só individuais, undefined = tudo. */
  groups?: string;
  companyId: number;
}

interface Response {
  tickets: Ticket[];
  count: number;
  hasMore: boolean;
}

const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  status,
  tab,
  date,
  showAll,
  userId,
  withUnreadMessages,
  whatsappIds,
  tagIds,
  groups,
  companyId
}: Request): Promise<Response> => {
  let whereCondition: Filterable["where"] = {
    companyId,
    [Op.or]: [{ userId }, { status: "pending" }],
    queueId: { [Op.or]: [queueIds, null] }
  };
  let includeCondition: Includeable[];

  includeCondition = [
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "profilePicUrl"]
    },
    {
      model: Queue,
      as: "queue",
      attributes: ["id", "name", "color"]
    },
    {
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["id", "name"]
    },
    {
      model: Tag,
      as: "tags",
      attributes: ["id", "name", "color"],
      through: { attributes: [] },
      required: false
    }
  ];

  if (showAll === "true") {
    whereCondition = { companyId, queueId: { [Op.or]: [queueIds, null] } };
  }

  // Regras das 3 abas do painel de atendimento (chat "aberto"):
  // - myTickets: tickets abertos atribuídos diretamente a mim (userId = eu),
  //   independente de qual setor estejam.
  // - attending: tickets abertos, COM atendente, em algum dos setores que
  //   tenho acesso, mas atribuídos a OUTRO atendente (não duplica "myTickets").
  // - waiting: tickets pendentes sem atendente, nos setores a que tenho
  //   acesso, mais os órfãos (sem setor). Exigir setor nulo aqui esvaziava a
  //   aba por completo assim que a empresa configurava um setor padrão, já que
  //   FindOrCreateTicketService passa a preencher queueId em todo ticket novo.
  if (tab === "myTickets") {
    whereCondition = {
      companyId,
      status: "open",
      userId
    };
  } else if (tab === "attending") {
    whereCondition = {
      companyId,
      status: "open",
      userId: ({ [Op.and]: [{ [Op.ne]: userId }, { [Op.not]: null }] } as unknown) as string,
      queueId: { [Op.or]: [queueIds] }
    };
  } else if (tab === "waiting") {
    whereCondition = {
      companyId,
      status: "pending",
      userId: null,
      queueId: { [Op.or]: [queueIds, null] }
    };
  } else if (tab === "groups") {
    // Grupos: todos os ativos da empresa, com ou sem atendente. Atribuir
    // grupo a um atendente específico raramente faz sentido no dia a dia.
    whereCondition = {
      companyId,
      status: { [Op.in]: ["open", "pending"] },
      isGroup: true
    };
  }

  if (status && !tab) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    includeCondition = [
      ...includeCondition,
      {
        model: Message,
        as: "messages",
        attributes: ["id", "body"],
        where: {
          body: where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        required: false,
        duplicating: false
      }
    ];

    whereCondition = {
      ...whereCondition,
      companyId,
      [Op.or]: [
        {
          "$contact.name$": where(
            fn("LOWER", col("contact.name")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        { "$contact.number$": { [Op.like]: `%${sanitizedSearchParam}%` } },
        {
          "$message.body$": where(
            fn("LOWER", col("body")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        }
      ]
    };
  }

  if (date) {
    whereCondition = {
      companyId,
      createdAt: {
        [Op.between]: [+startOfDay(parseISO(date)), +endOfDay(parseISO(date))]
      }
    };
  }

  if (withUnreadMessages === "true") {
    const user = await ShowUserService(userId);
    const userQueueIds = user.queues.map(queue => queue.id);

    whereCondition = {
      companyId,
      [Op.or]: [{ userId }, { status: "pending" }],
      queueId: { [Op.or]: [userQueueIds, null] },
      unreadMessages: { [Op.gt]: 0 }
    };
  }

  // Filtro por conexão. Aplicado por último, depois de todas as reatribuições
  // de whereCondition acima, para nunca ser sobrescrito por aba/data/não-lidas.
  if (whatsappIds && whatsappIds.length > 0) {
    whereCondition = {
      ...whereCondition,
      whatsappId: { [Op.in]: whatsappIds }
    };
  }

  // Filtro por etiqueta: força o join a ser obrigatório e restrito às tags
  // escolhidas. Aplicado depois do include base para não perder as demais.
  if (tagIds && tagIds.length > 0) {
    includeCondition = includeCondition.map(include => {
      const asName = (include as { as?: string }).as;
      if (asName !== "tags") return include;
      return {
        model: Tag,
        as: "tags",
        attributes: ["id", "name", "color"],
        through: { attributes: [] },
        where: { id: { [Op.in]: tagIds } },
        required: true
      };
    });
  }

  // Grupos: por padrão o painel mistura tudo; as abas do frontend usam este
  // filtro para separar conversas de grupo das individuais.
  if (groups === "only") {
    whereCondition = { ...whereCondition, isGroup: true };
  } else if (groups === "exclude") {
    whereCondition = { ...whereCondition, isGroup: false };
  }

  const limit = 40;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: tickets } = await Ticket.findAndCountAll({
    where: whereCondition,
    include: includeCondition,
    distinct: true,
    limit,
    offset,
    order: [["updatedAt", "DESC"]]
  });

  const hasMore = count > offset + tickets.length;

  return {
    tickets,
    count,
    hasMore
  };
};

export default ListTicketsService;
