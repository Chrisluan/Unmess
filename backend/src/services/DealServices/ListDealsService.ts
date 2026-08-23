import { Op, Sequelize } from "sequelize";
import Deal from "../../models/Deal";
import Customer from "../../models/Customer";
import Contact from "../../models/Contact";
import User from "../../models/User";
import PipelineStage from "../../models/PipelineStage";
import Order from "../../models/Order";
import DealAttachment from "../../models/DealAttachment";

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
 * Cards concluídos ("moved") continuam aparecendo, na coluna final onde
 * pararam. Antes sumiam, e o quadro passava a mentir sobre o que houve ali: um
 * orçamento aprovado desaparecia de Vendas como se nunca tivesse existido, e
 * quem procurasse pelo número não achava. Eles vêm marcados como concluídos,
 * e o relatório continua contando a jornada uma vez só pelo rootDealId.
 */
const ListDealsService = async ({
  searchParam = "",
  responsibleUserId,
  customerId,
  includeClosed = false,
  boardId,
  companyId
}: Request): Promise<Deal[]> => {
  /**
   * Só "lost" sai de vista por padrão.
   *
   * "moved" (concluído no quadro) e "won" (faturado) continuam aparecendo na
   * coluna onde pararam: os dois são registro do que aconteceu ali, e escondê-
   * los deixava a coluna final permanentemente vazia -- o card chegava ao
   * destino e sumia da tela como se tivesse sido apagado.
   */
  const escondidos = includeClosed ? [] : ["lost"];

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
        /**
         * Só a capa, não o material inteiro.
         *
         * O card do Kanban mostra uma imagem; carregar todos os arquivos de
         * todos os pedidos do quadro para usar um de cada seria trazer dezenas
         * de registros por card. `separate` faz disso uma consulta só, à parte,
         * em vez de um join que multiplicaria as linhas do quadro.
         */
        model: DealAttachment,
        as: "attachments",
        attributes: ["id", "fileName", "mimetype", "name"],
        where: { isPreview: true },
        required: false,
        separate: true
      },
      {
        // Distingue orçamento de pedido na tela: existe só depois que o card
        // saiu do funil de vendas.
        model: Order,
        as: "salesOrder",
        attributes: ["id", "number", "quoteNumber", "status"],
        required: false
      },
      {
        model: PipelineStage,
        as: "stage",
        attributes: ["id", "name", "color", "type", "isFinal", "isWon"],
        required: false
      }
    ]
  });

  return deals;
};

export default ListDealsService;
