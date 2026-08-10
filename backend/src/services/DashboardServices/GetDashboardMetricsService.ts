import { Op, fn, col, literal } from "sequelize";
import Ticket from "../../models/Ticket";
import TicketStatus from "../../models/TicketStatus";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";

interface Request {
  companyId: number;
  startDate?: string;
  endDate?: string;
}

interface AgentMetric {
  userId: number;
  name: string;
  totalChats: number;
  avgFirstResponseSeconds: number | null;
  avgHandlingSeconds: number | null;
}

interface QueueMetric {
  queueId: number;
  name: string;
  color: string;
  totalChats: number;
}

interface StatusMetric {
  closingStatusId: number | null;
  name: string;
  total: number;
}

interface ConnectionMetric {
  whatsappId: number;
  name: string;
  totalChats: number;
}

interface BucketMetric {
  label: string;
  total: number;
}

interface Response {
  totals: {
    open: number;
    pending: number;
    closed: number;
    totalPeriod: number;
  };
  avgFirstResponseSeconds: number | null;
  avgHandlingSeconds: number | null;
  /** Da primeira resposta até o encerramento — o tempo de conversa em si. */
  avgResolutionSeconds: number | null;
  /** Percentual de atendimentos do período que foram encerrados. */
  resolutionRate: number | null;
  /** Pendentes há mais de 30 minutos sem ninguém assumir. */
  stalePending: number;
  newContacts: number;
  byAgent: AgentMetric[];
  byQueue: QueueMetric[];
  byClosingStatus: StatusMetric[];
  byConnection: ConnectionMetric[];
  /** Volume por dia, para enxergar tendência. */
  byDay: BucketMetric[];
  /** Volume por hora do dia, para dimensionar escala de atendentes. */
  byHour: BucketMetric[];
}

// Métricas agregadas para o dashboard de gerenciamento de atendimento.
// Usa os timestamps dedicados (firstResponseAt, closedAt) já gravados pelo
// UpdateTicketService, evitando reprocessar mensagens a cada consulta.
const GetDashboardMetricsService = async ({
  companyId,
  startDate,
  endDate
}: Request): Promise<Response> => {
  const dateFilter =
    startDate && endDate
      ? {
          createdAt: {
            [Op.between]: [new Date(startDate), new Date(endDate)]
          }
        }
      : {};

  const baseWhere: any = { companyId, ...dateFilter };

  const [openCount, pendingCount, closedCount] = await Promise.all([
    Ticket.count({ where: { ...baseWhere, status: "open" } }),
    Ticket.count({ where: { ...baseWhere, status: "pending" } }),
    Ticket.count({ where: { ...baseWhere, status: "closed" } })
  ]);

  // Traz userId junto: é o que permite calcular as médias por atendente sem
  // uma consulta extra por pessoa.
  const closedTickets = await Ticket.findAll({
    where: {
      ...baseWhere,
      status: "closed",
      firstResponseAt: { [Op.not]: null }
    },
    attributes: ["userId", "createdAt", "firstResponseAt", "closedAt"]
  });

  const firstResponseDiffs: number[] = [];
  const handlingDiffs: number[] = [];
  const resolutionDiffs: number[] = [];

  closedTickets.forEach(t => {
    if (t.firstResponseAt) {
      firstResponseDiffs.push(
        (t.firstResponseAt.getTime() - t.createdAt.getTime()) / 1000
      );
    }
    if (t.closedAt) {
      handlingDiffs.push(
        (t.closedAt.getTime() - t.createdAt.getTime()) / 1000
      );
      if (t.firstResponseAt) {
        resolutionDiffs.push(
          (t.closedAt.getTime() - t.firstResponseAt.getTime()) / 1000
        );
      }
    }
  });

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  // Fila envelhecida: pendente sem atendente há mais de 30 minutos. É o número
  // que indica cliente esperando sem ninguém ter olhado.
  const stalePending = await Ticket.count({
    where: {
      ...baseWhere,
      status: "pending",
      userId: null,
      updatedAt: { [Op.lt]: new Date(Date.now() - 30 * 60 * 1000) }
    }
  });

  // Mesmo recorte de data dos tickets, aplicado à criação do contato.
  const contactWhere: any = { companyId, ...dateFilter };
  const newContacts = await Contact.count({ where: contactWhere });

  const agentRows = await Ticket.findAll({
    where: { ...baseWhere, userId: { [Op.not]: null } },
    attributes: [
      "userId",
      [fn("COUNT", col("Ticket.id")), "totalChats"]
    ],
    include: [{ model: User, as: "user", attributes: ["id", "name"] }],
    group: ["userId", "user.id"],
    raw: false
  });

  // Agrupa em memória a partir dos tickets já carregados. Antes cada atendente
  // disparava uma consulta própria dentro do map — com a equipe crescendo, o
  // dashboard ficava proporcionalmente mais lento.
  const porAtendente = new Map<number, { fr: number[]; h: number[] }>();

  closedTickets.forEach(t => {
    const uid = (t as any).userId as number | null;
    if (!uid) return;

    const acc = porAtendente.get(uid) || { fr: [], h: [] };
    porAtendente.set(uid, acc);

    if (t.firstResponseAt) {
      acc.fr.push((t.firstResponseAt.getTime() - t.createdAt.getTime()) / 1000);
    }
    if (t.closedAt) {
      acc.h.push((t.closedAt.getTime() - t.createdAt.getTime()) / 1000);
    }
  });

  const byAgent: AgentMetric[] = agentRows.map(row => {
    const acc = porAtendente.get(row.userId) || { fr: [], h: [] };

    return {
      userId: row.userId,
      name: row.user?.name || "—",
      totalChats: Number((row as any).get("totalChats")),
      avgFirstResponseSeconds: avg(acc.fr),
      avgHandlingSeconds: avg(acc.h)
    };
  });

  const queueRows = await Ticket.findAll({
    where: { ...baseWhere, queueId: { [Op.not]: null } },
    attributes: ["queueId", [fn("COUNT", col("Ticket.id")), "totalChats"]],
    include: [
      { model: Queue, as: "queue", attributes: ["id", "name", "color"] }
    ],
    group: ["queueId", "queue.id"],
    raw: false
  });

  const byQueue: QueueMetric[] = queueRows.map(row => ({
    queueId: row.queueId,
    name: row.queue?.name || "—",
    color: row.queue?.color || "#666",
    totalChats: Number((row as any).get("totalChats"))
  }));

  const statusRows = await Ticket.findAll({
    where: { ...baseWhere, status: "closed" },
    attributes: [
      "closingStatusId",
      [fn("COUNT", col("Ticket.id")), "total"]
    ],
    include: [
      {
        model: TicketStatus,
        as: "closingStatus",
        attributes: ["id", "name"]
      }
    ],
    group: ["closingStatusId", "closingStatus.id"],
    raw: false
  });

  const byClosingStatus: StatusMetric[] = statusRows.map(row => ({
    closingStatusId: row.closingStatusId,
    name: row.closingStatus?.name || "Sem status definido",
    total: Number((row as any).get("total"))
  }));

  const connectionRows = await Ticket.findAll({
    where: { ...baseWhere, whatsappId: { [Op.not]: null } },
    attributes: ["whatsappId", [fn("COUNT", col("Ticket.id")), "totalChats"]],
    include: [{ model: Whatsapp, as: "whatsapp", attributes: ["id", "name"] }],
    group: ["whatsappId", "whatsapp.id"],
    raw: false
  });

  const byConnection: ConnectionMetric[] = connectionRows.map(row => ({
    whatsappId: row.whatsappId,
    name: row.whatsapp?.name || "—",
    totalChats: Number((row as any).get("totalChats"))
  }));

  // Agregação no banco em vez de trazer todos os tickets para contar em JS:
  // o período pode ter milhares de linhas e só precisamos dos totais.
  const dayRows: any[] = await Ticket.findAll({
    where: baseWhere,
    attributes: [
      [fn("DATE", col("Ticket.createdAt")), "dia"],
      [fn("COUNT", col("Ticket.id")), "total"]
    ],
    group: [fn("DATE", col("Ticket.createdAt"))],
    order: [[literal("dia"), "ASC"]],
    raw: true
  });

  const byDay: BucketMetric[] = dayRows.map(r => ({
    label: String(r.dia),
    total: Number(r.total)
  }));

  const hourRows: any[] = await Ticket.findAll({
    where: baseWhere,
    attributes: [
      [fn("HOUR", col("Ticket.createdAt")), "hora"],
      [fn("COUNT", col("Ticket.id")), "total"]
    ],
    group: [fn("HOUR", col("Ticket.createdAt"))],
    raw: true
  });

  // As 24 horas sempre presentes: um gráfico com buracos sugeriria ausência de
  // dado em vez de ausência de movimento.
  const totaisPorHora = new Map<number, number>(
    hourRows.map(r => [Number(r.hora), Number(r.total)])
  );
  const byHour: BucketMetric[] = Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, "0")}h`,
    total: totaisPorHora.get(h) || 0
  }));

  const totalPeriod = openCount + pendingCount + closedCount;

  return {
    totals: {
      open: openCount,
      pending: pendingCount,
      closed: closedCount,
      totalPeriod
    },
    avgFirstResponseSeconds: avg(firstResponseDiffs),
    avgHandlingSeconds: avg(handlingDiffs),
    avgResolutionSeconds: avg(resolutionDiffs),
    resolutionRate: totalPeriod ? (closedCount / totalPeriod) * 100 : null,
    stalePending,
    newContacts,
    byAgent,
    byQueue,
    byClosingStatus,
    byConnection,
    byDay,
    byHour
  };
};

export default GetDashboardMetricsService;
