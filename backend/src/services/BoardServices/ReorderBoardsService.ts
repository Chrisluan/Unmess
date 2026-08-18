import AppError from "../../errors/AppError";
import Board from "../../models/Board";
import sequelize from "../../database";
import ListBoardsService from "./ListBoardsService";

interface Request {
  boardIds: number[];
  companyId: number;
}

/**
 * Reordena a fila de quadros.
 *
 * A ordem não é cosmética: ela define para onde o card vai ao concluir um
 * quadro, e qual quadro é o último (o que fatura a venda). Por isso roda em
 * transação — uma ordenação pela metade deixaria dois quadros disputando a
 * mesma posição e o encadeamento ficaria imprevisível.
 */
const ReorderBoardsService = async ({
  boardIds,
  companyId
}: Request): Promise<Board[]> => {
  const boards = await Board.findAll({ where: { companyId } });

  const idsValidos = new Set(boards.map(board => board.id));
  const desconhecido = boardIds.find(id => !idsValidos.has(Number(id)));

  if (desconhecido) {
    throw new AppError("ERR_NO_BOARD_FOUND", 404);
  }

  await sequelize.transaction(async t => {
    await Promise.all(
      boardIds.map((id, indice) =>
        Board.update(
          { order: indice },
          { where: { id, companyId }, transaction: t }
        )
      )
    );
  });

  return ListBoardsService(companyId);
};

export default ReorderBoardsService;
