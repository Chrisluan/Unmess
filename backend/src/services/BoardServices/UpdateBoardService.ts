import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Board from "../../models/Board";

interface BoardData {
  name?: string;
  color?: string;
  isSalesFunnel?: boolean;
}

interface Request {
  boardData: BoardData;
  boardId: string | number;
  companyId: number;
  transaction?: Transaction;
}

const UpdateBoardService = async ({
  boardData,
  boardId,
  companyId,
  transaction
}: Request): Promise<Board> => {
  const board = await Board.findOne({ where: { id: boardId, companyId }, transaction });

  if (!board) {
    throw new AppError("ERR_NO_BOARD_FOUND", 404);
  }

  const { name } = boardData;

  if (name && name !== board.name) {
    const nameExists = await Board.findOne({
      where: { name, companyId, id: { [Op.ne]: board.id } },
      transaction
    });

    if (nameExists) {
      throw new AppError("ERR_DUPLICATED_BOARD");
    }
  }

  // O funil de vendas é um só: marcar outro desmarca o anterior, senão a
  // pergunta "gerar pedido?" apareceria em dois lugares do processo.
  if (boardData.isSalesFunnel) {
    await Board.update(
      { isSalesFunnel: false },
      { where: { companyId, id: { [Op.ne]: board.id } }, transaction }
    );
  }

  // Só os campos do quadro: o corpo da requisição chegava inteiro.
  const { color, isSalesFunnel } = boardData;
  await board.update({ name, color, isSalesFunnel }, { transaction });
  await board.reload({ include: ["stages"], transaction });

  return board;
};

export default UpdateBoardService;
