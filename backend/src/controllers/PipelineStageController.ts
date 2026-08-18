import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListPipelineStagesService from "../services/PipelineStageServices/ListPipelineStagesService";
import CreatePipelineStageService from "../services/PipelineStageServices/CreatePipelineStageService";
import UpdatePipelineStageService from "../services/PipelineStageServices/UpdatePipelineStageService";
import DeletePipelineStageService from "../services/PipelineStageServices/DeletePipelineStageService";
import ReorderPipelineStagesService from "../services/PipelineStageServices/ReorderPipelineStagesService";
import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";

interface StageData {
  name: string;
  color?: string;
  type?: string;
  isFinal?: boolean;
  isInitial?: boolean;
  // Destino da coluna final: quadro e, opcionalmente, coluna exata.
  targetBoardId?: number | null;
  targetStageId?: number | null;
  // Exigido pelo schema no store; opcional no update, que não troca o quadro.
  boardId: number;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { boardId } = req.query as { boardId?: string };

  const stages = await ListPipelineStagesService(getCompanyId(req), boardId);

  return res.json(stages);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newStage: StageData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    type: Yup.string().oneOf(["open", "lost"]),
    boardId: Yup.number().required()
  });

  try {
    await schema.validate(newStage);
  } catch (err) {
    throw new AppError(err.message);
  }

  const stage = await CreatePipelineStageService({
    ...newStage,
    boardId: newStage.boardId,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("pipelineStage", {
    action: "create",
    stage
  });

  return res.status(200).json(stage);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const stageData: StageData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string(),
    type: Yup.string().oneOf(["open", "lost"]),
    isFinal: Yup.boolean(),
    isInitial: Yup.boolean(),
    targetBoardId: Yup.number().nullable(),
    targetStageId: Yup.number().nullable()
  });

  try {
    await schema.validate(stageData);
  } catch (err) {
    throw new AppError(err.message);
  }

  const { stageId } = req.params;

  const stage = await UpdatePipelineStageService({
    stageData,
    stageId,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("pipelineStage", {
    action: "update",
    stage
  });

  return res.status(200).json(stage);
};

/**
 * Recebe a lista de ids na ordem em que as colunas devem aparecer.
 */
export const reorder = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { stageIds, boardId } = req.body;

  if (!Array.isArray(stageIds) || !boardId) {
    throw new AppError("ERR_INVALID_STAGE_ORDER");
  }

  const stages = await ReorderPipelineStagesService({
    stageIds,
    boardId,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("pipelineStage", {
    action: "reorder",
    stages
  });

  return res.status(200).json(stages);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { stageId } = req.params;

  await DeletePipelineStageService(stageId, getCompanyId(req));

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("pipelineStage", {
    action: "delete",
    stageId
  });

  return res.status(200).json({ message: "Pipeline stage deleted" });
};
