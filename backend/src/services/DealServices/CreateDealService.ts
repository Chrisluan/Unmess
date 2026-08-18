import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import DealActivity from "../../models/DealActivity";
import PipelineStage from "../../models/PipelineStage";
import ShowDealService from "./ShowDealService";
import ListBoardsService from "../BoardServices/ListBoardsService";

interface Request {
  title: string;
  value?: number;
  expectedCloseAt?: Date;
  notes?: string;
  stageId?: number;
  boardId?: number;
  customerId?: number;
  contactId?: number;
  responsibleUserId?: number;
  companyId: number;
  userId?: number;
}

const CreateDealService = async ({
  title,
  value = 0,
  expectedCloseAt,
  notes,
  stageId,
  boardId,
  customerId,
  contactId,
  responsibleUserId,
  companyId,
  userId
}: Request): Promise<Deal> => {
  /**
   * Sem coluna informada o card entra na primeira coluna do quadro pedido —
   * ou do primeiro quadro do fluxo, que é onde a jornada normalmente começa.
   */
  const stage = await (async () => {
    if (stageId) {
      return PipelineStage.findOne({ where: { id: stageId, companyId } });
    }

    const boards = await ListBoardsService(companyId);
    const board = boardId
      ? boards.find(item => item.id === Number(boardId))
      : boards[0];

    if (!board) return null;

    return PipelineStage.findOne({
      where: { boardId: board.id, companyId },
      order: [
        ["order", "ASC"],
        ["id", "ASC"]
      ]
    });
  })();

  if (!stage) {
    throw new AppError("ERR_NO_PIPELINE_STAGE_FOUND", 404);
  }

  // Criar direto na coluna final puliria o quadro inteiro sem passar pelo
  // fluxo; o card entra na primeira coluna do quadro nesse caso.
  const colunaDeEntrada = stage.isFinal
    ? await PipelineStage.findOne({
        where: { boardId: stage.boardId, companyId },
        order: [
          ["order", "ASC"],
          ["id", "ASC"]
        ]
      })
    : stage;

  const destino = colunaDeEntrada || stage;

  // Card novo entra no topo da coluna; os demais descem uma posição.
  await Deal.increment("order", {
    by: 1,
    where: { stageId: destino.id, companyId, status: "open" }
  });

  const deal = await Deal.create({
    title,
    value,
    expectedCloseAt: expectedCloseAt || null,
    notes,
    stageId: destino.id,
    boardId: destino.boardId,
    customerId: customerId || null,
    contactId: contactId || null,
    responsibleUserId: responsibleUserId || null,
    status: destino.type === "lost" ? "lost" : "open",
    order: 0,
    companyId
  });

  await DealActivity.create({
    type: "created",
    body: destino.name,
    dealId: deal.id,
    userId: userId || null,
    companyId
  });

  return ShowDealService(deal.id, companyId);
};

export default CreateDealService;
