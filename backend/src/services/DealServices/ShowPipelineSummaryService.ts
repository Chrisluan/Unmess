import Board from "../../models/Board";
import Deal from "../../models/Deal";

interface Request {
  responsibleUserId?: string;
  companyId: number;
}

interface Response {
  // Ainda no primeiro quadro: oportunidade, não venda
  pipelineValue: number;
  pipelineCount: number;
  // Já passou do primeiro quadro e ainda não faturou: venda em andamento
  inProgressValue: number;
  inProgressCount: number;
  // Chegou ao fim do último quadro: venda faturada
  billedValue: number;
  billedCount: number;
  lostCount: number;
  // Percentual de jornadas encerradas que faturaram
  conversionRate: number;
}

/**
 * Números do fluxo inteiro, para o cabeçalho do CRM.
 *
 * Conta jornadas, não cards. Como cada quadro cria um card novo, somar cards
 * faria a mesma venda valer quatro vezes ao chegar no Financeiro — por isso o
 * agrupamento é pela raiz da cadeia (`rootDealId || id`) e cada jornada entra
 * uma única vez, no estágio mais avançado que alcançou.
 */
const ShowPipelineSummaryService = async ({
  responsibleUserId,
  companyId
}: Request): Promise<Response> => {
  const where: any = { companyId };

  if (responsibleUserId) {
    where.responsibleUserId = responsibleUserId;
  }

  const primeiroBoard = await Board.findOne({
    where: { companyId },
    order: [["order", "ASC"]]
  });

  const deals = await Deal.findAll({
    where,
    attributes: ["id", "value", "status", "boardId", "rootDealId"]
  });

  // Uma entrada por jornada, guardando o card mais avançado dela.
  const jornadas = new Map<
    number,
    { value: number; status: string; saiuDoFunil: boolean }
  >();

  deals.forEach(deal => {
    const chave = deal.rootDealId || deal.id;
    const atual = jornadas.get(chave);

    const saiuDoFunil = Boolean(
      primeiroBoard && deal.boardId && deal.boardId !== primeiroBoard.id
    );

    if (!atual) {
      jornadas.set(chave, { value: deal.value, status: deal.status, saiuDoFunil });
      return;
    }

    // O card "moved" é histórico; o que vale é o card vivo da jornada. Entre
    // dois vivos, o mais adiantado no fluxo é quem define o estágio.
    if (atual.status === "moved" && deal.status !== "moved") {
      jornadas.set(chave, { value: deal.value, status: deal.status, saiuDoFunil });
      return;
    }

    if (deal.status !== "moved" && saiuDoFunil && !atual.saiuDoFunil) {
      jornadas.set(chave, { value: deal.value, status: deal.status, saiuDoFunil });
    }
  });

  const resumo: Response = {
    pipelineValue: 0,
    pipelineCount: 0,
    inProgressValue: 0,
    inProgressCount: 0,
    billedValue: 0,
    billedCount: 0,
    lostCount: 0,
    conversionRate: 0
  };

  jornadas.forEach(jornada => {
    if (jornada.status === "won") {
      resumo.billedValue += jornada.value;
      resumo.billedCount += 1;
    } else if (jornada.status === "lost") {
      resumo.lostCount += 1;
    } else if (jornada.saiuDoFunil) {
      resumo.inProgressValue += jornada.value;
      resumo.inProgressCount += 1;
    } else {
      resumo.pipelineValue += jornada.value;
      resumo.pipelineCount += 1;
    }
  });

  const encerradas = resumo.billedCount + resumo.lostCount;

  resumo.conversionRate =
    encerradas > 0 ? Math.round((resumo.billedCount / encerradas) * 100) : 0;

  return resumo;
};

export default ShowPipelineSummaryService;
