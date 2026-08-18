import AppError from "../../errors/AppError";
import Board from "../../models/Board";
import PipelineStage from "../../models/PipelineStage";

interface Request {
  name: string;
  color?: string;
  type?: string;
  boardId: number;
  companyId: number;
}

const CreatePipelineStageService = async ({
  name,
  color,
  type = "open",
  boardId,
  companyId
}: Request): Promise<PipelineStage> => {
  const board = await Board.findOne({ where: { id: boardId, companyId } });

  if (!board) {
    throw new AppError("ERR_NO_BOARD_FOUND", 404);
  }

  const nameExists = await PipelineStage.findOne({
    where: { name, boardId }
  });

  if (nameExists) {
    throw new AppError("ERR_DUPLICATED_PIPELINE_STAGE");
  }

  // Coluna nova entra no fim do quadro.
  const ultima = await PipelineStage.findOne({
    where: { boardId },
    order: [["order", "DESC"]]
  });

  return PipelineStage.create({
    name,
    color,
    type,
    // A coluna final é definida à parte; nenhuma coluna nasce final para não
    // roubar o encerramento de quem já era.
    isFinal: false,
    order: ultima ? ultima.order + 1 : 0,
    boardId,
    companyId
  });
};

export default CreatePipelineStageService;
