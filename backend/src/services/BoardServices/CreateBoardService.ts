import AppError from "../../errors/AppError";
import Board from "../../models/Board";
import PipelineStage from "../../models/PipelineStage";

interface Request {
  name: string;
  color?: string;
  companyId: number;
}

/**
 * Quadro novo entra no fim da fila e já nasce com duas colunas: uma porta de
 * entrada e uma saída.
 *
 * Uma coluna só não serviria — sendo entrada e saída ao mesmo tempo, o card
 * concluiria o quadro no instante em que chegasse.
 */
const CreateBoardService = async ({
  name,
  color,
  companyId
}: Request): Promise<Board> => {
  const nameExists = await Board.findOne({ where: { name, companyId } });

  if (nameExists) {
    throw new AppError("ERR_DUPLICATED_BOARD");
  }

  const ultimo = await Board.findOne({
    where: { companyId },
    order: [["order", "DESC"]]
  });

  const board = await Board.create({
    name,
    color,
    order: ultimo ? ultimo.order + 1 : 0,
    companyId
  });

  await PipelineStage.bulkCreate([
    {
      name: "A fazer",
      color: "#90a4ae",
      type: "open",
      isInitial: true,
      isFinal: false,
      order: 0,
      boardId: board.id,
      companyId
    },
    {
      name: "Concluído",
      color: "#66bb6a",
      type: "open",
      isInitial: false,
      isFinal: true,
      order: 1,
      boardId: board.id,
      companyId
    }
  ]);

  await board.reload({ include: ["stages"] });

  return board;
};

export default CreateBoardService;
