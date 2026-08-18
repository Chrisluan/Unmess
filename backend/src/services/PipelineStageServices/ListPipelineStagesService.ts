import PipelineStage from "../../models/PipelineStage";
import ListBoardsService from "../BoardServices/ListBoardsService";

/**
 * Colunas de um quadro, na ordem de exibição.
 *
 * Sem `boardId` devolve as colunas de todos os quadros da empresa — usado por
 * telas que precisam resolver o nome de uma coluna qualquer.
 */
const ListPipelineStagesService = async (
  companyId: number,
  boardId?: string | number
): Promise<PipelineStage[]> => {
  // Garante que a empresa tenha fluxo antes de listar; sem isso um CRM recém
  // aberto devolveria lista vazia e a tela ficaria sem saída.
  await ListBoardsService(companyId);

  const where: any = { companyId };

  if (boardId) {
    where.boardId = boardId;
  }

  return PipelineStage.findAll({
    where,
    order: [
      ["boardId", "ASC"],
      ["order", "ASC"],
      ["id", "ASC"]
    ]
  });
};

export default ListPipelineStagesService;
