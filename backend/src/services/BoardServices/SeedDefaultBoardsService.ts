import { Transaction } from "sequelize";
import Board from "../../models/Board";
import PipelineStage from "../../models/PipelineStage";
import DEFAULT_BOARDS from "../../helpers/DefaultBoards";

/**
 * Cria o fluxo padrão (quadros + colunas) para uma empresa.
 *
 * Usado tanto ao cadastrar empresa nova quanto como rede de segurança ao abrir
 * um CRM sem nenhum quadro — sem quadro não há onde criar card, e a tela vira
 * um beco sem saída.
 */
const SeedDefaultBoardsService = async (
  companyId: number,
  transaction?: Transaction
): Promise<Board[]> => {
  const criados: Board[] = [];

  for (const [indice, modelo] of DEFAULT_BOARDS.entries()) {
    const board = await Board.create(
      {
        name: modelo.name,
        color: modelo.color,
        order: indice,
        companyId
      },
      { transaction }
    );

    await PipelineStage.bulkCreate(
      modelo.stages.map((stage, posicao) => ({
        name: stage.name,
        color: stage.color,
        type: stage.type,
        isInitial: Boolean(stage.isInitial),
        isFinal: Boolean(stage.isFinal),
        order: posicao,
        boardId: board.id,
        companyId
      })),
      { transaction }
    );

    criados.push(board);
  }

  return criados;
};

export default SeedDefaultBoardsService;
