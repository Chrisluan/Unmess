import { Op, fn, col } from "sequelize";
import Ticket from "../../models/Ticket";
import TicketStatus from "../../models/TicketStatus";
import User from "../../models/User";
import Queue from "../../models/Queue";

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

interface Response {
  totals: {
    open: number;
    pending: number;
    closed: number;
    totalPeriod: number;
  };
  avgFirstResponseSeconds: number | null;
  avgHandlingSeconds: number | null;
  byAgent: AgentMetric[];
  byQueue: QueueMetric[];
  byClosingStatus: StatusMetric[];
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

  const closedTickets = await Ticket.findAll({
    where: {
      ...baseWhere,
      status: "closed",
      firstResponseAt: { [Op.not]: null }
    },
    attributes: ["createdAt", "firstResponseAt", "closedAt"]
  });

  const firstResponseDiffs: number[] = [];
  const handlingDiffs: number[] = [];

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
    }
  });

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

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

  const byAgent: AgentMetric[] = await Promise.all(
    agentRows.map(async row => {
      const userTickets = closedTickets.filter(
        t => (t as any).userId === row.userId
      );

      // fallback: caso a subconsulta acima não traga firstResponseAt/closedAt
      // por não estar no include, buscamos direto pra esse agente
      const agentClosed = await Ticket.findAll({
        where: {
          ...baseWhere,
          userId: row.userId,
          status: "closed",
          firstResponseAt: { [Op.not]: null }
        },
        attributes: ["createdAt", "firstResponseAt", "closedAt"]
      });

      const frDiffs = agentClosed
        .filter(t => t.firstResponseAt)
        .map(
          t => (t.firstResponseAt.getTime() - t.createdAt.getTime()) / 1000
        );
      const hDiffs = agentClosed
        .filter(t => t.closedAt)
        .map(t => (t.closedAt.getTime() - t.createdAt.getTime()) / 1000);

      return {
        userId: row.userId,
        name: row.user?.name || "—",
        totalChats: Number((row as any).get("totalChats")),
        avgFirstResponseSeconds: avg(frDiffs),
        avgHandlingSeconds: avg(hDiffs)
      };
    })
  );

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

  return {
    totals: {
      open: openCount,
      pending: pendingCount,
      closed: closedCount,
      totalPeriod: openCount + pendingCount + closedCount
    },
    avgFirstResponseSeconds: avg(firstResponseDiffs),
    avgHandlingSeconds: avg(handlingDiffs),
    byAgent,
    byQueue,
    byClosingStatus
  };
};

export default GetDashboardMetricsService;
