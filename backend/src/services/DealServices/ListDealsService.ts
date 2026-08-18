import { Op, Sequelize } from "sequelize";
import Deal from "../../models/Deal";
import Customer from "../../models/Customer";
import Contact from "../../models/Contact";
import User from "../../models/User";
import PipelineStage from "../../models/PipelineStage";

interface Request {
  searchParam?: string;
  responsibleUserId?: string;
  customerId?: string;
  // Inclui no quadro os cards já encerrados (faturados e perdidos).
  includeClosed?: boolean;
  boardId?: string;
  companyId: number;
}

/**
 * Carrega os cards de um quadro.
 *
 * Devolve tudo de uma vez em vez de paginar: o Kanban precisa dos totais por
 * coluna corretos, e somar página por página daria número errado. O volume é
 * controlado pelo filtro de quadro.
 *
 * Cards com status "moved" nunca aparecem: eles concluíram o quadro e já
 * viraram outro card adiante, então mostrá-los seria contar o mesmo trabalho
 * duas vezes na tela.
 */
const ListDealsService = async ({
  searchParam = "",
  responsibleUserId,
  customerId,
  includeClosed = false,
  boardId,
  companyId
}: Request): Promise<Deal[]> => {
  // "moved" nunca aparece; "won"/"lost" só quando explicitamente pedidos.
  const escondidos = includeClosed ? ["moved"] : ["moved", "won", "lost"];

  const whereCondition: any = {
    companyId,
    status: { [Op.notIn]: escondidos }
  };

  if (boardId) {
    whereCondition.boardId = boardId;
  }

  const busca = searchParam.toLowerCase().trim();

  if (busca) {
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("Deal.title")),
        "LIKE",
        `%${busca}%`
      ),
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("customer.name")),
        "LIKE",
        `%${busca}%`
      ),
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("customer.tradeName")),
        "LIKE",
        `%${busca}%`
      )
    ];
  }

  if (responsibleUserId) {
    whereCondition.responsibleUserId = responsibleUserId;
  }

  if (customerId) {
    whereCondition.customerId = customerId;
  }


  const deals = await Deal.findAll({
    where: whereCondition,
    order: [
      ["order", "ASC"],
      ["id", "DESC"]
    ],
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: ["id", "name", "tradeName", "document"],
        // required: false para o negócio sem cliente vinculado continuar
        // aparecendo no board.
        required: false
      },
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"],
        required: false
      },
      {
        model: User,
        as: "responsibleUser",
        attributes: ["id", "name"],
        required: false
      },
      {
        model: PipelineStage,
        as: "stage",
        attributes: ["id", "name", "color", "type", "isFinal"],
        required: false
      }
    ]
  });

  return deals;
};

export default ListDealsService;
