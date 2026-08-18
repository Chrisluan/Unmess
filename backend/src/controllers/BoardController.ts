import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListBoardsService from "../services/BoardServices/ListBoardsService";
import CreateBoardService from "../services/BoardServices/CreateBoardService";
import UpdateBoardService from "../services/BoardServices/UpdateBoardService";
import ReorderBoardsService from "../services/BoardServices/ReorderBoardsService";
import DeleteBoardService from "../services/BoardServices/DeleteBoardService";
import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";

interface BoardData {
  name: string;
  color?: string;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const boards = await ListBoardsService(getCompanyId(req));

  return res.json(boards);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newBoard: BoardData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string().required()
  });

  try {
    await schema.validate(newBoard);
  } catch (err) {
    throw new AppError(err.message);
  }

  const board = await CreateBoardService({
    ...newBoard,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("board", {
    action: "create",
    board
  });

  return res.status(200).json(board);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const boardData: BoardData = req.body;
  const { boardId } = req.params;

  const board = await UpdateBoardService({
    boardData,
    boardId,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("board", {
    action: "update",
    board
  });

  return res.status(200).json(board);
};

/**
 * Recebe os ids na ordem em que os quadros devem ficar. A ordem define o
 * caminho do card, então mexer aqui muda o fluxo da empresa.
 */
export const reorder = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { boardIds } = req.body;

  if (!Array.isArray(boardIds)) {
    throw new AppError("ERR_INVALID_BOARD_ORDER");
  }

  const boards = await ReorderBoardsService({
    boardIds,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("board", {
    action: "reorder",
    boards
  });

  return res.status(200).json(boards);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { boardId } = req.params;

  await DeleteBoardService(boardId, getCompanyId(req));

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("board", {
    action: "delete",
    boardId
  });

  return res.status(200).json({ message: "Board deleted" });
};
