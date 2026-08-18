import AppError from "../../errors/AppError";
import PipelineStage from "../../models/PipelineStage";
import sequelize from "../../database";

interface Request {
  stageIds: number[];
  boardId: number;
  companyId: number;
}

/**
 * Grava a ordem das colunas a partir da lista que o board mandou.
 *
 * Roda em transação porque uma ordenação pela metade deixaria colunas
 * empatadas no mesmo `order` e o board embaralharia sozinho no próximo load.
 */
const ReorderPipelineStagesService = async ({
  stageIds,
  boardId,
  companyId
}: Request): Promise<PipelineStage[]> => {
  const stages = await PipelineStage.findAll({
    where: { companyId, boardId }
  });

  const idsValidos = new Set(stages.map(stage => stage.id));
  const desconhecido = stageIds.find(id => !idsValidos.has(Number(id)));

  if (desconhecido) {
    throw new AppError("ERR_NO_PIPELINE_STAGE_FOUND", 404);
  }

  await sequelize.transaction(async t => {
    await Promise.all(
      stageIds.map((id, indice) =>
        PipelineStage.update(
          { order: indice },
          { where: { id, companyId, boardId }, transaction: t }
        )
      )
    );
  });

  return PipelineStage.findAll({
    where: { companyId, boardId },
    order: [
      ["order", "ASC"],
      ["id", "ASC"]
    ]
  });
};

export default ReorderPipelineStagesService;
