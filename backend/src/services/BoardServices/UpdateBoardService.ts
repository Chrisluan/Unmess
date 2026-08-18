import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Board from "../../models/Board";

interface BoardData {
  name?: string;
  color?: string;
}

interface Request {
  boardData: BoardData;
  boardId: string | number;
  companyId: number;
}

const UpdateBoardService = async ({
  boardData,
  boardId,
  companyId
}: Request): Promise<Board> => {
  const board = await Board.findOne({ where: { id: boardId, companyId } });

  if (!board) {
    throw new AppError("ERR_NO_BOARD_FOUND", 404);
  }

  const { name } = boardData;

  if (name && name !== board.name) {
    const nameExists = await Board.findOne({
      where: { name, companyId, id: { [Op.ne]: board.id } }
    });

    if (nameExists) {
      throw new AppError("ERR_DUPLICATED_BOARD");
    }
  }

  await board.update(boardData);
  await board.reload({ include: ["stages"] });

  return board;
};

export default UpdateBoardService;
