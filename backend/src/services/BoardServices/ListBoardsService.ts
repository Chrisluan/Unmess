import Board from "../../models/Board";
import PipelineStage from "../../models/PipelineStage";
import SeedDefaultBoardsService from "./SeedDefaultBoardsService";
import { EscopoResolvido, alcanca } from "../../helpers/permissions/escopos";

/**
 * Quadros da empresa na ordem do fluxo, cada um com suas colunas.
 *
 * Empresa sem nenhum quadro (criada antes do CRM, ou quadros apagados) recebe
 * o fluxo padrão em vez de uma tela vazia sem saída.
 *
 * O escopo entra por último, e isso importa: a decisão de semear o fluxo
 * padrão olha os quadros da empresa, não os que esta pessoa alcança. Filtrar
 * antes faria alguém restrito a um quadro que ainda não existe disparar a
 * criação de um fluxo inteiro só porque a lista dele voltou vazia.
 */
const ListBoardsService = async (
  companyId: number,
  escopo?: EscopoResolvido
): Promise<Board[]> => {
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

  const noEscopo = (lista: Board[]): Board[] =>
    escopo ? lista.filter(board => alcanca(escopo, board.id)) : lista;

  const boards = await carregar();

  if (boards.length > 0) {
    return noEscopo(boards);
  }

  await SeedDefaultBoardsService(companyId);

  return noEscopo(await carregar());
};

export default ListBoardsService;
