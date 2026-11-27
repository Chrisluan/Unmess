import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Board from "../../models/Board";
import PipelineStage from "../../models/PipelineStage";

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

  // Só os campos do quadro: o corpo da requisição chegava inteiro. Campo
  // ausente fica como está (undefined não pode virar NULL no banco).
  const { color, isSalesFunnel } = boardData;
  const campos: BoardData = {};
  if (name !== undefined) campos.name = name;
  if (color !== undefined) campos.color = color;
  if (isSalesFunnel !== undefined) campos.isSalesFunnel = isSalesFunnel;
  await board.update(campos, { transaction });

  // Funil sem etapa de ganho é uma configuração recusada pelas regras de
  // consistência -- e a tela só deixa marcar ganho etapa a etapa. Sem isto,
  // marcar o funil exigiria adivinhar a ordem certa dos cliques. A etapa
  // final que não é de perda é onde a venda fecha: vira a de ganho, que a
  // pessoa pode trocar depois. Quadro sem etapa final continua recusado.
  if (isSalesFunnel) {
    const etapas = await PipelineStage.findAll({
      where: { boardId: board.id, companyId },
      order: [["order", "ASC"]],
      transaction
    });
    const ativas = etapas.filter(e => e.active !== false);
    if (!ativas.some(e => e.isWon)) {
      const fechamento = ativas.find(e => e.isFinal && e.type !== "lost");
      if (fechamento) await fechamento.update({ isWon: true }, { transaction });
    }
  }

  await board.reload({ include: ["stages"], transaction });

  return board;
};

export default UpdateBoardService;
