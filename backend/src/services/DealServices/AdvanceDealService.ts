import { Op } from "sequelize";
import Board from "../../models/Board";
import Deal from "../../models/Deal";
import DealActivity from "../../models/DealActivity";
import PipelineStage from "../../models/PipelineStage";
import DealTicket from "../../models/DealTicket";
import sequelize from "../../database";
import Order from "../../models/Order";
import ProximoNumeroService from "../SequenceServices/ProximoNumeroService";
import MarcarGanhoService from "./MarcarGanhoService";

interface Request {
  deal: Deal;
  stage: PipelineStage;
  companyId: number;
  userId?: number;
  /**
   * Se o card deve seguir para o quadro seguinte.
   *
   * Quem decide é quem arrastou: nem todo orçamento aprovado vira pedido, e
   * antes o avanço era automático -- bastava soltar na coluna final para o
   * trabalho aparecer na Produção sem ninguém ter confirmado.
   */
  gerarProximo?: boolean;
  /** Motivo, quando o destino for uma coluna de perda. */
  lostReason?: string;
}

export interface AdvanceResult {
  // Card que estava no quadro e saiu (arquivado ou faturado).
  origem: Deal;
  // Card recém-criado no quadro seguinte. Nulo quando a venda foi faturada.
  destino: Deal | null;
  nextBoard: Board | null;
}

/**
 * Resolve para onde uma coluna final manda o card.
 *
 * A precedência vai do mais específico ao mais genérico, porque é assim que a
 * configuração fica previsível: coluna exata escolhida pelo admin, senão a
 * porta de entrada do quadro escolhido, senão o próximo quadro da fila.
 *
 * Devolver nulo significa fim da linha — não há para onde ir, e a venda fatura.
 */
export const resolverDestino = async (
  stage: PipelineStage,
  boardAtual: Board | null,
  companyId: number
): Promise<{ board: Board; coluna: PipelineStage } | null> => {
  const portaDeEntrada = (boardId: number) =>
    PipelineStage.findOne({
      where: { boardId, companyId },
      // A coluna marcada como inicial ganha; sem nenhuma, a primeira da ordem.
      order: [
        ["isInitial", "DESC"],
        ["order", "ASC"],
        ["id", "ASC"]
      ]
    });

  if (stage.targetStageId) {
    const coluna = await PipelineStage.findOne({
      where: { id: stage.targetStageId, companyId }
    });

    if (coluna) {
      const board = await Board.findOne({
        where: { id: coluna.boardId, companyId }
      });
      if (board) return { board, coluna };
    }
  }

  if (stage.targetBoardId) {
    const board = await Board.findOne({
      where: { id: stage.targetBoardId, companyId }
    });
    const coluna = board ? await portaDeEntrada(board.id) : null;

    if (board && coluna) return { board, coluna };
  }

  // Sem destino configurado, segue a ordem dos quadros.
  const proximo = boardAtual
    ? await Board.findOne({
        where: { companyId, order: { [Op.gt]: boardAtual.order } },
        order: [["order", "ASC"]]
      })
    : null;

  if (!proximo) return null;

  const coluna = await portaDeEntrada(proximo.id);

  return coluna ? { board: proximo, coluna } : null;
};

/**
 * Conclusão de quadro.
 *
 * Chegar numa coluna final significa que o trabalho daquele quadro acabou. O
 * card fica onde está, marcado como concluído, e uma cópia nasce na porta de
 * entrada do quadro seguinte -- referenciando o número do card de origem.
 *
 * O card de origem permanece visível de propósito. Antes ele sumia, e o quadro
 * passava a mentir sobre o que aconteceu: um orçamento aprovado desaparecia de
 * Vendas, e quem procurasse pelo número não achava mais nada.
 *
 * Os cards da jornada ficam amarrados pelo `rootDealId`. Sem isso o relatório
 * contaria a mesma venda uma vez por quadro percorrido.
 *
 * Coluna final sem destino e sem quadro seguinte é o fim da linha: fatura.
 */
const AdvanceDealService = async ({
  deal,
  stage,
  companyId,
  userId,
  gerarProximo = true,
  lostReason
}: Request): Promise<AdvanceResult> => {
  const boardAtual = await Board.findOne({
    where: { id: deal.boardId, companyId }
  });

  const destino = await resolverDestino(stage, boardAtual, companyId);

  // Chave da cadeia: este card pode já ser derivado de outro.
  const rootDealId = deal.rootDealId || deal.id;

  /**
   * Coluna marcada como ganho fecha a venda aqui mesmo, ainda que o trabalho
   * siga para o quadro seguinte.
   *
   * Antes o ganho só existia no fim da fila de quadros: um card que passava por
   * "Ganho" no funil e ia para a Produção virava "moved", e o faturamento
   * ficava parado até a jornada terminar no último quadro.
   */
  if (stage.isWon) {
    await MarcarGanhoService({
      deal,
      companyId,
      userId,
      origem: boardAtual ? `${boardAtual.name} → ${stage.name}` : stage.name
    });
  }

  // Fim da linha: a coluna final fatura a venda.
  if (!destino) {
    await deal.update({
      stageId: stage.id,
      status: "won",
      closedAt: new Date()
    });

    // Devolve false quando a venda já tinha sido ganha antes na jornada — daí o
    // registro não se repete na timeline.
    await MarcarGanhoService({
      deal,
      companyId,
      userId,
      origem: boardAtual ? boardAtual.name : stage.name
    });

    return { origem: deal, destino: null, nextBoard: null };
  }

  // Concluir sem seguir adiante: o trabalho deste quadro acabou, mas ninguém
  // pediu para abrir pedido no próximo. O card fica marcado como concluído.
  if (!gerarProximo) {
    await deal.update({
      stageId: stage.id,
      status: "moved",
      archivedAt: new Date()
    });

    await DealActivity.create({
      type: "board_done",
      body: boardAtual ? boardAtual.name : stage.name,
      dealId: deal.id,
      userId: userId || null,
      companyId
    });

    return { origem: deal, destino: null, nextBoard: null };
  }

  const { board: nextBoard, coluna: colunaDestino } = destino;

  const novo = await sequelize.transaction(async t => {
    // O card que sai deixa de ocupar posição na coluna de origem.
    await deal.update(
      {
        stageId: stage.id,
        status: "moved",
        archivedAt: new Date()
      },
      { transaction: t }
    );

    // Abre espaço no topo da coluna de destino.
    await Deal.increment("order", {
      by: 1,
      where: { stageId: colunaDestino.id, companyId, status: "open" },
      transaction: t
    });

    return Deal.create(
      {
        // O número do card de origem viaja junto: em Produção, saber que aquilo
        // veio do orçamento 128 é o que liga o trabalho ao que foi vendido.
        title: deal.title,
        value: deal.value,
        expectedCloseAt: deal.expectedCloseAt,
        notes: deal.notes,
        customerId: deal.customerId,
        contactId: deal.contactId,
        responsibleUserId: deal.responsibleUserId,
        stageId: colunaDestino.id,
        boardId: nextBoard.id,
        rootDealId,
        previousDealId: deal.id,
        // Destino pode ser uma coluna de perda (o quadro Financeiro manda o
        // encerrado de volta para "Perdido" em Vendas). Nesse caso o card não
        // nasce aberto: nasce perdido, com o motivo junto.
        status: colunaDestino.type === "lost" ? "lost" : "open",
        lostReason: colunaDestino.type === "lost" ? lostReason || null : null,
        closedAt: colunaDestino.type === "lost" ? new Date() : null,
        order: 0,
        companyId
      },
      { transaction: t }
    );
  });

  /**
   * Saiu do funil: o que era orçamento passa a ser pedido.
   *
   * O pedido ganha numeração própria da empresa e guarda de qual orçamento
   * nasceu -- são contadores independentes, e por isso tabelas separadas.
   * Só acontece na saída do funil: entre Produção e Expedição o card continua
   * sendo o mesmo pedido, e numerar de novo criaria dois números para o mesmo
   * trabalho.
   */
  if (boardAtual?.isSalesFunnel) {
    const numero = await ProximoNumeroService(companyId, "order");

    await Order.create({
      number: numero,
      quoteNumber: deal.quoteNumber || null,
      dealId: novo.id,
      value: deal.value,
      status: "open",
      companyId
    });
  }

  // As conversas de WhatsApp seguem o card: quem está na Produção precisa
  // chegar no mesmo atendimento que originou o pedido.
  const vinculos = await DealTicket.findAll({ where: { dealId: deal.id } });

  if (vinculos.length > 0) {
    await DealTicket.bulkCreate(
      vinculos.map(vinculo => ({
        dealId: novo.id,
        ticketId: vinculo.ticketId
      }))
    );
  }

  await DealActivity.create({
    type: "board_out",
    body: `${boardAtual ? boardAtual.name : "?"} → ${nextBoard.name}`,
    dealId: deal.id,
    userId: userId || null,
    companyId
  });

  await DealActivity.create({
    type: "board_in",
    body: `${boardAtual ? boardAtual.name : "?"} → ${nextBoard.name}`,
    dealId: novo.id,
    userId: userId || null,
    companyId
  });

  return { origem: deal, destino: novo, nextBoard };
};

export default AdvanceDealService;
