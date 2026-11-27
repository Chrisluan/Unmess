import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Board from "../../models/Board";
import PipelineStage from "../../models/PipelineStage";
import Deal from "../../models/Deal";

interface StageData {
  name?: string;
  color?: string;
  type?: string;
  isFinal?: boolean;
  isInitial?: boolean;
  targetBoardId?: number | null;
  targetStageId?: number | null;
  /** Chance de fechamento nesta etapa, usada no valor ponderado do funil. */
  probability?: number;
  /** Ganho explicito, em vez de deduzido de "acabou o funil". */
  isWon?: boolean;
  /** Desativar preserva o historico de quem passou pela coluna. */
  active?: boolean;
}

interface Request {
  stageData: StageData;
  stageId: string | number;
  companyId: number;
  transaction?: Transaction;
}

const UpdatePipelineStageService = async ({
  stageData,
  stageId,
  companyId,
  transaction
}: Request): Promise<PipelineStage> => {
  const stage = await PipelineStage.findOne({
    where: { id: stageId, companyId },
    transaction
  });

  if (!stage) {
    throw new AppError("ERR_NO_PIPELINE_STAGE_FOUND", 404);
  }

  const { name, type, isFinal, isInitial, targetBoardId, targetStageId } =
    stageData;

  if (name && name !== stage.name) {
    const nameExists = await PipelineStage.findOne({
      where: { name, boardId: stage.boardId, id: { [Op.ne]: stage.id } },
      transaction
    });

    if (nameExists) {
      throw new AppError("ERR_DUPLICATED_PIPELINE_STAGE");
    }
  }

  // Coluna final e coluna de perda são papéis opostos: uma conclui o quadro, a
  // outra encerra o card como perdido. Deixar as duas marcas juntas tornaria o
  // comportamento do arrasto imprevisível.
  const tipoFinal = type ?? stage.type;

  if ((isFinal ?? stage.isFinal) && tipoFinal === "lost") {
    throw new AppError("ERR_FINAL_STAGE_CANNOT_BE_LOST");
  }

  // A porta de entrada precisa ser única: o card que chega de outro quadro tem
  // de ter um destino sem ambiguidade. Colunas finais, ao contrário, podem ser
  // várias — cada uma com seu destino.
  if (isInitial) {
    await PipelineStage.update(
      { isInitial: false },
      { where: { boardId: stage.boardId, id: { [Op.ne]: stage.id } }, transaction }
    );
  }

  if (targetStageId) {
    const alvo = await PipelineStage.findOne({
      where: { id: targetStageId, companyId },
      transaction
    });

    if (!alvo) {
      throw new AppError("ERR_NO_PIPELINE_STAGE_FOUND", 404);
    }

    // Mandar o card para uma coluna do próprio quadro não é avançar, é andar
    // em círculo — o card sairia e voltaria para o mesmo lugar.
    if (alvo.boardId === stage.boardId) {
      throw new AppError("ERR_STAGE_TARGET_SAME_BOARD");
    }
  }

  if (targetBoardId && Number(targetBoardId) === Number(stage.boardId)) {
    throw new AppError("ERR_STAGE_TARGET_SAME_BOARD");
  }

  if (targetBoardId) {
    const quadroAlvo = await Board.findOne({
      where: { id: targetBoardId, companyId },
      transaction
    });

    if (!quadroAlvo) {
      throw new AppError("ERR_NO_BOARD_FOUND", 404);
    }
  }

  const tipoAntigo = stage.type;

  // Só os campos da etapa: o corpo da requisição chegava inteiro e dava para
  // mudar a etapa de quadro ou de empresa.
  const { color, probability, isWon, active } = stageData;
  await stage.update(
    { name, color, type, isFinal, isInitial, targetBoardId, targetStageId, probability, isWon, active },
    { transaction }
  );

  // Virar coluna de perda encerra quem já estava lá dentro; sair dela reabre.
  if (type && type !== tipoAntigo) {
    await Deal.update(
      {
        status: type === "lost" ? "lost" : "open",
        closedAt: type === "lost" ? new Date() : null
      },
      { where: { stageId: stage.id, companyId, status: { [Op.ne]: "moved" } }, transaction }
    );
  }

  return stage;
};

export default UpdatePipelineStageService;
