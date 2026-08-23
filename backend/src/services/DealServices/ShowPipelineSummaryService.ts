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
  // Cruzou uma coluna de ganho (ou o fim da fila de quadros): venda faturada
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
    attributes: ["id", "value", "status", "boardId", "rootDealId", "wonAt"]
  });

  // Uma entrada por jornada, guardando o card mais avançado dela.
  const jornadas = new Map<
    number,
    { value: number; status: string; saiuDoFunil: boolean }
  >();

  /**
   * O faturado é somado **por card**, não por jornada.
   *
   * Uma jornada se ramifica: o orçamento aprovado abre vários cards adiante,
   * pedaços diferentes do mesmo trabalho, e cada um chega ao faturamento com
   * seu próprio valor. Contar uma vez por jornada fazia o segundo card em
   * diante entrar mudo -- ia para "Faturado" e o número no topo não se mexia.
   *
   * O valor é o do card que cruzou a coluna de ganho, e não o do card mais
   * avançado da jornada: é aquele que registra o que foi vendido.
   */
  let faturadoValor = 0;
  let faturadoQtd = 0;

  deals.forEach(deal => {
    /**
     * Card já faturado sai da conta das jornadas.
     *
     * Ele foi somado aqui; deixá-lo também representar a jornada colocaria o
     * mesmo dinheiro em dois blocos da faixa. E a jornada continua existindo
     * nos blocos de aberto/em andamento pelos cards que ainda estão vivos --
     * que é o certo, porque numa jornada ramificada faturar um pedaço não
     * encerra os outros.
     */
    if (deal.wonAt) {
      faturadoValor += deal.value;
      faturadoQtd += 1;
      return;
    }

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

  resumo.billedValue = faturadoValor;
  resumo.billedCount = faturadoQtd;

  jornadas.forEach(jornada => {
    if (jornada.status === "lost") {
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
