import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import DealActivity from "../../models/DealActivity";
import PipelineStage from "../../models/PipelineStage";
import ShowDealService from "./ShowDealService";
import Board from "../../models/Board";
import { descreverMotivo } from "../../helpers/MotivosDePerda";
import AdvanceDealService, { resolverDestino } from "./AdvanceDealService";
import sequelize from "../../database";

interface Request {
  dealId: string | number;
  stageId: number;
  // Posição desejada dentro da coluna de destino. Sem ela o card vai para o fim.
  order?: number;
  lostReason?: string;
  /** Se a coluna final deve abrir o card no quadro seguinte. */
  gerarProximo?: boolean;
  companyId: number;
  userId?: number;
}

export interface MoveResult {
  /**
   * Preenchido quando um card concluído voltou atrás e já existe uma cópia
   * adiante. Não impede nada -- serve para a tela dizer onde ela está.
   */
  avisoCopia?: { boardName: string; dealId: number } | null;
  deal: Deal;
  // Card criado no quadro seguinte, quando o movimento concluiu o quadro.
  advancedTo: Deal | null;
  nextBoardName: string | null;
}

/**
 * Move o card dentro de um quadro.
 *
 * Concentra aqui tudo que o arrastar dispara: reordenar as duas colunas
 * afetadas, acertar status conforme a coluna de destino e deixar o rastro na
 * timeline. Espalhar isso pelo controller faria a ordem divergir entre quem
 * arrastou e quem recebeu o evento pelo socket.
 *
 * Cair numa coluna final delega para AdvanceDealService: o card sai do quadro
 * e renasce no próximo, ou fatura a venda se não houver próximo.
 */
const MoveDealService = async ({
  dealId,
  stageId,
  order,
  lostReason,
  companyId,
  userId,
  gerarProximo
}: Request): Promise<MoveResult> => {
  const deal = await Deal.findOne({ where: { id: dealId, companyId } });

  if (!deal) {
    throw new AppError("ERR_NO_DEAL_FOUND", 404);
  }

  /**
   * Card concluído pode voltar atrás.
   *
   * Antes era proibido, e isso travava a correção do erro mais comum: concluir
   * o quadro sem querer. Agora volta, e quem volta é avisado de que já existe
   * uma cópia adiante -- proibir não desfazia a cópia, só impedia o conserto.
   */
  const copiaAdiante =
    deal.status === "moved"
      ? await Deal.findOne({
          where: { previousDealId: deal.id, companyId },
          include: [{ model: Board, as: "board", attributes: ["id", "name"] }]
        })
      : null;

  const stage = await PipelineStage.findOne({
    where: { id: stageId, companyId }
  });

  if (!stage) {
    throw new AppError("ERR_NO_PIPELINE_STAGE_FOUND", 404);
  }

  // Arrastar entre quadros diferentes não é permitido: o caminho é definido
  // pela fila de quadros, não pelo arrasto.
  if (stage.boardId !== deal.boardId) {
    throw new AppError("ERR_DEAL_CROSS_BOARD_MOVE");
  }

  // Vale para qualquer coluna de perda, em qualquer quadro: sem motivo, não
  // registra.
  if (stage.type === "lost" && !lostReason) {
    throw new AppError("ERR_LOST_REASON_REQUIRED");
  }

  // Voltar reabre o card: ele estava concluído e vai ocupar uma coluna de
  // trabalho de novo.
  if (deal.status === "moved" && !stage.isFinal) {
    await deal.update({ status: "open", archivedAt: null });
  }

  const etapaAnterior = await PipelineStage.findByPk(deal.stageId);
  const mudouDeEtapa = deal.stageId !== stage.id;
  const posicaoAntiga = deal.order;

  // Coluna final conclui o quadro — o card sai daqui e a posição na coluna
  // deixa de importar.
  if (stage.isFinal) {
    // Libera a posição que o card ocupava antes de sair.
    await Deal.increment("order", {
      by: -1,
      where: {
        companyId,
        stageId: deal.stageId,
        status: "open",
        order: { [Op.gt]: posicaoAntiga }
      }
    });

    if (mudouDeEtapa) {
      await DealActivity.create({
        type: "stage_change",
        body: `${etapaAnterior ? etapaAnterior.name : "?"} → ${stage.name}`,
        dealId: deal.id,
        userId: userId || null,
        companyId
      });
    }

    // O destino pode ser uma coluna de perda em outro quadro -- é o caso de
    // "Encerrado" no Financeiro, que devolve o card para "Perdido" em Vendas.
    // Perder sem motivo registrado deixa o relatório sem resposta para a única
    // pergunta que importa ali: por que perdemos.
    const boardDaVez = await Board.findOne({ where: { id: deal.boardId, companyId } });
    const destinoPrevisto = await resolverDestino(stage, boardDaVez, companyId);

    if (destinoPrevisto?.coluna?.type === "lost" && !lostReason) {
      throw new AppError("ERR_LOST_REASON_REQUIRED");
    }

    const { destino, nextBoard } = await AdvanceDealService({
      deal,
      stage,
      companyId,
      userId,
      gerarProximo,
      lostReason
    });

    return {
      deal: await ShowDealService(deal.id, companyId),
      advancedTo: destino ? await ShowDealService(destino.id, companyId) : null,
      nextBoardName: destino && nextBoard ? nextBoard.name : null
    };
  }

  // Sem posição informada, o card vai para o fim da coluna de destino.
  const posicaoNova = await (async () => {
    if (order !== undefined && order !== null) return order;

    const total = await Deal.count({
      where: { stageId: stage.id, companyId, status: "open" }
    });

    // Vindo de outra coluna o card ocupa uma posição a mais; ficando na mesma
    // coluna ele apenas vai para a última posição que já existe.
    return mudouDeEtapa ? total : Math.max(total - 1, 0);
  })();

  await sequelize.transaction(async t => {
    if (mudouDeEtapa) {
      // Fecha o buraco deixado na coluna de origem...
      await Deal.increment("order", {
        by: -1,
        where: {
          companyId,
          stageId: deal.stageId,
          status: "open",
          order: { [Op.gt]: posicaoAntiga }
        },
        transaction: t
      });

      // ...e abre espaço na coluna de destino.
      await Deal.increment("order", {
        by: 1,
        where: {
          companyId,
          stageId: stage.id,
          status: "open",
          order: { [Op.gte]: posicaoNova }
        },
        transaction: t
      });
    } else if (posicaoNova !== posicaoAntiga) {
      // Reordenação dentro da mesma coluna: só o trecho entre a posição antiga
      // e a nova se desloca, e o sentido depende de o card ter subido ou descido.
      const subiu = posicaoNova < posicaoAntiga;

      await Deal.increment("order", {
        by: subiu ? 1 : -1,
        where: {
          companyId,
          stageId: stage.id,
          status: "open",
          id: { [Op.ne]: deal.id },
          order: subiu
            ? { [Op.gte]: posicaoNova, [Op.lt]: posicaoAntiga }
            : { [Op.gt]: posicaoAntiga, [Op.lte]: posicaoNova }
        },
        transaction: t
      });
    }

    await deal.update(
      {
        stageId: stage.id,
        order: posicaoNova,
        status: stage.type === "lost" ? "lost" : "open",
        // Voltar um card perdido para uma coluna de trabalho o reabre e limpa
        // o motivo da perda.
        closedAt: stage.type === "lost" ? deal.closedAt || new Date() : null,
        lostReason:
          stage.type === "lost" ? lostReason || deal.lostReason : null
      },
      { transaction: t }
    );
  });

  if (mudouDeEtapa) {
    await DealActivity.create({
      type: stage.type === "lost" ? "lost" : "stage_change",
      body: `${etapaAnterior ? etapaAnterior.name : "?"} → ${stage.name}`,
      dealId: deal.id,
      userId: userId || null,
      companyId
    });
  }

  return {
    deal: await ShowDealService(deal.id, companyId),
    avisoCopia: copiaAdiante
      ? { boardName: copiaAdiante.board?.name || "outro quadro", dealId: copiaAdiante.id }
      : null,
    advancedTo: null,
    nextBoardName: null
  };
};

export default MoveDealService;
