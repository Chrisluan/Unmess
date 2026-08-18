import AppError from "../../errors/AppError";
import Board from "../../models/Board";
import Deal from "../../models/Deal";

/**
 * Quadro com card ativo dentro não é apagado: os cards sumiriam do fluxo sem
 * aviso, e os que já tivessem passado por ali perderiam o histórico. A pessoa
 * precisa esvaziar o quadro antes.
 *
 * Cards arquivados (que já avançaram) não impedem a exclusão — eles são
 * histórico, e o vínculo com o quadro cai junto por cascade.
 */
const DeleteBoardService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const board = await Board.findOne({ where: { id, companyId } });

  if (!board) {
    throw new AppError("ERR_NO_BOARD_FOUND", 404);
  }

  const total = await Board.count({ where: { companyId } });

  if (total <= 1) {
    throw new AppError("ERR_LAST_BOARD");
  }

  const cardsAtivos = await Deal.count({
    where: { boardId: board.id, companyId, status: "open" }
  });

  if (cardsAtivos > 0) {
    throw new AppError("ERR_BOARD_NOT_EMPTY");
  }

  await board.destroy();
};

export default DeleteBoardService;
