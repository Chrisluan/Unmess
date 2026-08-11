import {
  Op,
  literal,
  Filterable,
  Includeable,
  WhereAttributeHash
} from "sequelize";
import { startOfDay, endOfDay, parseISO } from "date-fns";

import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import ShowUserService from "../UserServices/ShowUserService";
import Whatsapp from "../../models/Whatsapp";
import Tag from "../../models/Tag";
import { buildTabWhere, buildContactWhere } from "../../helpers/TicketTabRules";

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
  /**
   * Filtro por atendente responsável. Vazio = todos. Só chega aqui preenchido
   * quando o controller confirmou que o usuário pode ver todas as conversas.
   */
  userIds?: number[];
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
  userIds,
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
      // isKnown vai junto para o frontend distinguir a conversa na lista.
      attributes: ["id", "name", "number", "profilePicUrl", "isKnown"]
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

  // As abas do painel são definidas uma única vez em TicketTabRules, de onde
  // saem tanto esta cláusula quanto a regra que o frontend recebe pela API.
  const tabWhere = tab
    ? buildTabWhere(tab, { companyId, userId, queueIds })
    : null;

  if (tabWhere) {
    whereCondition = tabWhere;
  }

  // Abas que filtram por atributo do contato viram condição no join. required
  // fica true para o join restringir a consulta, não só enriquecer o retorno.
  const contactWhere = tab ? buildContactWhere(tab) : null;
  if (contactWhere) {
    includeCondition = includeCondition.map(include =>
      (include as { as?: string }).as === "contact"
        ? {
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "number", "profilePicUrl", "isKnown"],
            where: contactWhere,
            required: true
          }
        : include
    );
  }

  if (status && !tab) {
    whereCondition = {
      ...whereCondition,
      status
    };
  }

  if (searchParam) {
    const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

    // A busca só compara colunas da própria tabela de tickets (contactId, id).
    // Referenciar "contact.name" ou "message.body" direto quebrava com
    // "Unknown column in where clause": o limit faz o Sequelize embrulhar a
    // consulta numa subconsulta onde esses joins não existem.
    //
    // O termo passa pelo escape do Sequelize — é entrada do usuário indo para
    // SQL literal.
    const conexao = Ticket.sequelize;
    if (!conexao) throw new AppError("ERR_DB_NOT_INITIALIZED");

    const termo = conexao.escape(`%${sanitizedSearchParam}%`);
    const empresa = conexao.escape(companyId);

    const criterios: WhereAttributeHash[] = [
      {
        contactId: {
          [Op.in]: literal(
            `(SELECT id FROM Contacts WHERE companyId = ${empresa} ` +
              `AND (LOWER(name) LIKE ${termo} OR number LIKE ${termo}))`
          )
        }
      },
      {
        id: {
          [Op.in]: literal(
            `(SELECT DISTINCT ticketId FROM Messages WHERE LOWER(body) LIKE ${termo})`
          )
        }
      }
    ];

    // Protocolo (AAAAMMDD + id com 6 dígitos, ver BuildTicketProtocol).
    //
    // Só entra na busca quando o termo é numérico do começo ao fim. Assim
    // "joão 11" não vira consulta por protocolo — o "11" casaria com quase
    // tudo. Separadores comuns são tolerados porque o cliente dita o número em
    // blocos e o atendente digita como ouviu ("2026 0729 000482", "#2026...").
    //
    // O mínimo de 4 dígitos existe pelo mesmo motivo: termo mais curto é quase
    // sempre pedaço de telefone, que as outras cláusulas já cobrem.
    //
    // Casa por trecho para aceitar tanto o protocolo colado inteiro quanto só
    // o final, que é o pedaço que o atendente costuma digitar.
    const protocoloDigitado = sanitizedSearchParam.replace(/[\s.\-/#]/g, "");

    if (/^\d{4,}$/.test(protocoloDigitado)) {
      criterios.push({
        protocol: { [Op.like]: `%${protocoloDigitado}%` }
      });
    }

    whereCondition = {
      ...whereCondition,
      companyId,
      [Op.or]: criterios
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

  // Filtro por atendente. Mesma posição do filtro de conexão, e pelo mesmo
  // motivo: aplicado por último para não ser sobrescrito por aba/data.
  // Ele restringe o que a aba já traz — nunca amplia a visibilidade.
  if (userIds && userIds.length > 0) {
    whereCondition = {
      ...whereCondition,
      userId: { [Op.in]: userIds }
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
