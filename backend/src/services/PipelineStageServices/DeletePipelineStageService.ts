import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import PipelineStage from "../../models/PipelineStage";
import Deal from "../../models/Deal";

/**
 * Coluna com card ativo dentro não é apagada em silêncio: o card sumiria do
 * quadro sem aviso. A pessoa precisa esvaziar a coluna antes.
 *
 * A coluna final também não sai enquanto for a única saída do quadro — sem
 * ela, nada avançaria para o quadro seguinte.
 */
const DeletePipelineStageService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const stage = await PipelineStage.findOne({
    where: { id, companyId }
  });

  if (!stage) {
    throw new AppError("ERR_NO_PIPELINE_STAGE_FOUND", 404);
  }

  const cardsAtivos = await Deal.count({
    where: { stageId: stage.id, companyId, status: { [Op.ne]: "moved" } }
  });

  if (cardsAtivos > 0) {
    throw new AppError("ERR_PIPELINE_STAGE_NOT_EMPTY");
  }

  const totalNoQuadro = await PipelineStage.count({
    where: { boardId: stage.boardId }
  });

  if (totalNoQuadro <= 1) {
    throw new AppError("ERR_LAST_STAGE_IN_BOARD");
  }

  // Várias colunas finais são permitidas; o que não pode é o quadro ficar sem
  // nenhuma saída, senão nada avançaria dali para frente.
  if (stage.isFinal) {
    const outrasFinais = await PipelineStage.count({
      where: { boardId: stage.boardId, isFinal: true, id: { [Op.ne]: stage.id } }
    });

    if (outrasFinais === 0) {
      throw new AppError("ERR_CANNOT_DELETE_LAST_FINAL_STAGE");
    }
  }

  // Mesma lógica para a porta de entrada: sem ela o card que chega de outro
  // quadro não teria onde pousar.
  if (stage.isInitial) {
    throw new AppError("ERR_CANNOT_DELETE_INITIAL_STAGE");
  }

  await stage.destroy();
};

export default DeletePipelineStageService;
