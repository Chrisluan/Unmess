import Board from "../../models/Board";
import PipelineStage from "../../models/PipelineStage";
import SeedDefaultBoardsService from "./SeedDefaultBoardsService";

/**
 * Quadros da empresa na ordem do fluxo, cada um com suas colunas.
 *
 * Empresa sem nenhum quadro (criada antes do CRM, ou quadros apagados) recebe
 * o fluxo padrão em vez de uma tela vazia sem saída.
 */
const ListBoardsService = async (companyId: number): Promise<Board[]> => {
  const carregar = () =>
    Board.findAll({
      where: { companyId },
      order: [
        ["order", "ASC"],
        ["id", "ASC"],
        [{ model: PipelineStage, as: "stages" }, "order", "ASC"]
      ],
      include: [{ model: PipelineStage, as: "stages", required: false }]
    });

  const boards = await carregar();

  if (boards.length > 0) {
    return boards;
  }

  await SeedDefaultBoardsService(companyId);

  return carregar();
};

export default ListBoardsService;
