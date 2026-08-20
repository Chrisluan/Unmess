import { Op, WhereOptions, literal } from "sequelize";
import Deal from "../../models/Deal";
import DealItem from "../../models/DealItem";
import DealTag from "../../models/DealTag";
import Tag from "../../models/Tag";
import Customer from "../../models/Customer";
import Contact from "../../models/Contact";
import User from "../../models/User";
import PipelineStage from "../../models/PipelineStage";
import Board from "../../models/Board";

export interface FiltrosOportunidade {
  companyId: number;
  boardId?: number | string;
  searchParam?: string;
  responsibleUserId?: number | string;
  /** "sem responsável" é diferente de "qualquer responsável". */
  semResponsavel?: boolean;
  stageId?: number | string;
  customerId?: number | string;
  origin?: string;
  priority?: string;
  serviceStatus?: string;
  tagIds?: number[];
  valorMinimo?: number;
  valorMaximo?: number;
  criadoDe?: string;
  criadoAte?: string;
  /** Follow-up marcado para antes de agora e ainda não atendido. */
  atrasadas?: boolean;
  followUpHoje?: boolean;
  /** Nenhuma interação registrada nos últimos N dias. */
  semInteracaoDias?: number;
  includeClosed?: boolean;
  ordenacao?: string;
  pagina?: number;
  porPagina?: number;
}

const ORDENACOES: Record<string, any[]> = {
  recentes: [["createdAt", "DESC"]],
  antigas: [["createdAt", "ASC"]],
  interacao: [["lastInteractionAt", "DESC"]],
  followup: [["nextFollowUpAt", "ASC"]],
  maior_valor: [["value", "DESC"]],
  menor_valor: [["value", "ASC"]],
  // A posição gravada é a ordem que a pessoa arrumou à mão no quadro; é ela
  // que vale quando ninguém pediu outra coisa.
  posicao: [["order", "ASC"], ["id", "DESC"]]
};

/**
 * Prioridade não ordena por ordem alfabética.
 *
 * "urgent" vem depois de "normal" no dicionário e antes na urgência. Sem esta
 * tradução, ordenar por prioridade colocaria justamente o urgente no fim.
 */
const ORDEM_PRIORIDADE = literal(
  "FIELD(Deal.priority, 'urgent', 'high', 'normal', 'low')"
);

/**
 * Busca de oportunidades com os filtros do funil.
 *
 * Todos os filtros são combináveis e todos acontecem no banco -- filtrar no
 * navegador exigiria trazer a base inteira para descartar quase tudo, e o
 * Kanban precisa continuar rápido com milhares de cards.
 */
const FiltrarOportunidadesService = async (filtros: FiltrosOportunidade) => {
  const {
    companyId,
    boardId,
    searchParam,
    responsibleUserId,
    semResponsavel,
    stageId,
    customerId,
    origin,
    priority,
    serviceStatus,
    tagIds,
    valorMinimo,
    valorMaximo,
    criadoDe,
    criadoAte,
    atrasadas,
    followUpHoje,
    semInteracaoDias,
    includeClosed = false,
    ordenacao = "posicao",
    pagina,
    porPagina
  } = filtros;

  const where: WhereOptions & Record<string, any> = { companyId };

  if (!includeClosed) where.status = { [Op.notIn]: ["won", "lost"] };
  if (boardId) where.boardId = boardId;
  if (stageId) where.stageId = stageId;
  if (customerId) where.customerId = customerId;
  if (origin) where.origin = origin;
  if (priority) where.priority = priority;
  if (serviceStatus) where.serviceStatus = serviceStatus;

  if (semResponsavel) where.responsibleUserId = { [Op.is]: null };
  else if (responsibleUserId) where.responsibleUserId = responsibleUserId;

  if (valorMinimo !== undefined || valorMaximo !== undefined) {
    where.value = {
      ...(valorMinimo !== undefined ? { [Op.gte]: valorMinimo } : {}),
      ...(valorMaximo !== undefined ? { [Op.lte]: valorMaximo } : {})
    };
  }

  if (criadoDe || criadoAte) {
    where.createdAt = {
      ...(criadoDe ? { [Op.gte]: new Date(criadoDe) } : {}),
      ...(criadoAte ? { [Op.lte]: new Date(`${criadoAte}T23:59:59`) } : {})
    };
  }

  const agora = new Date();

  if (atrasadas) where.nextFollowUpAt = { [Op.lt]: agora };

  if (followUpHoje) {
    const inicio = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(agora);
    fim.setHours(23, 59, 59, 999);
    where.nextFollowUpAt = { [Op.between]: [inicio, fim] };
  }

  if (semInteracaoDias) {
    const limite = new Date(agora.getTime() - semInteracaoDias * 86400000);
    // Nunca interagida também conta: o card criado e esquecido é o caso mais
    // comum de oportunidade parada.
    where[Op.or as any] = [
      { lastInteractionAt: { [Op.lt]: limite } },
      { lastInteractionAt: { [Op.is]: null } }
    ];
  }

  /**
   * A busca cobre o que a pessoa tem à mão quando procura: o nome que deu ao
   * negócio, o número do orçamento que o cliente citou, ou o telefone que
   * apareceu no WhatsApp.
   */
  const termo = searchParam?.trim();
  const incluirCliente: any = {
    model: Customer,
    as: "customer",
    required: false,
    attributes: ["id", "name", "email", "phone"]
  };
  const incluirContato: any = {
    model: Contact,
    as: "contact",
    required: false,
    attributes: ["id", "name", "number"]
  };

  if (termo) {
    const como = { [Op.like]: `%${termo}%` };
    const somenteDigitos = termo.replace(/\D/g, "");

    where[Op.or as any] = [
      { title: como },
      { notes: como },
      ...(Number.isFinite(Number(termo)) ? [{ quoteNumber: Number(termo) }] : []),
      ...(Number.isFinite(Number(termo)) ? [{ id: Number(termo) }] : []),
      literal(
        `EXISTS (SELECT 1 FROM Customers c WHERE c.id = Deal.customerId AND (c.name LIKE ${Deal.sequelize?.escape(
          `%${termo}%`
        )} OR c.email LIKE ${Deal.sequelize?.escape(`%${termo}%`)}))`
      ),
      ...(somenteDigitos.length >= 4
        ? [
            literal(
              `EXISTS (SELECT 1 FROM Contacts ct WHERE ct.id = Deal.contactId AND ct.number LIKE ${Deal.sequelize?.escape(
                `%${somenteDigitos}%`
              )})`
            )
          ]
        : [])
    ];
  }

  // Filtrar por etiqueta exige que o card tenha TODAS as escolhidas, e não
  // qualquer uma: quem marca "VIP" e "Urgente" quer a interseção.
  if (tagIds?.length) {
    where[Op.and as any] = [
      ...((where[Op.and as any] as any[]) || []),
      literal(
        `(SELECT COUNT(DISTINCT dt.tagId) FROM DealTags dt WHERE dt.dealId = Deal.id AND dt.tagId IN (${tagIds
          .map(Number)
          .filter(Number.isFinite)
          .join(",")})) = ${tagIds.length}`
      )
    ];
  }

  const order =
    ordenacao === "prioridade"
      ? [[ORDEM_PRIORIDADE, "ASC"] as any]
      : ORDENACOES[ordenacao] || ORDENACOES.posicao;

  const paginado = pagina && porPagina;

  const { count, rows } = await Deal.findAndCountAll({
    where,
    include: [
      incluirCliente,
      incluirContato,
      { model: User, as: "responsibleUser", required: false, attributes: ["id", "name"] },
      { model: PipelineStage, as: "stage", required: false, attributes: ["id", "name", "color", "probability", "type", "isWon", "isFinal"] },
      { model: Board, as: "board", required: false, attributes: ["id", "name", "isSalesFunnel"] },
      { model: Tag, as: "tags", required: false, through: { attributes: [] }, attributes: ["id", "name", "color"] },
      { model: DealItem, as: "items", required: false, separate: true, order: [["position", "ASC"]] }
    ],
    order,
    // distinct: sem ele o total é inflado pelo join das etiquetas, e a
    // paginação passa a mostrar páginas vazias no fim.
    distinct: true,
    ...(paginado
      ? { limit: Number(porPagina), offset: (Number(pagina) - 1) * Number(porPagina) }
      : {})
  });

  return {
    deals: rows,
    count,
    hasMore: paginado ? Number(pagina) * Number(porPagina) < count : false
  };
};

export default FiltrarOportunidadesService;
