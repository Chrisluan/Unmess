import Deal from "../../models/Deal";
import Customer from "../../models/Customer";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Board from "../../models/Board";
import PipelineStage from "../../models/PipelineStage";
import DealActivity from "../../models/DealActivity";
import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";

/**
 * Negócio completo, com timeline e conversas vinculadas — alimenta o painel
 * de detalhes que abre ao clicar no card.
 */
const ShowDealService = async (
  id: string | number,
  companyId: number
): Promise<Deal> => {
  const deal = await Deal.findOne({
    where: { id, companyId },
    include: [
      { model: Customer, as: "customer", required: false },
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
        attributes: ["id", "name", "color", "type", "isFinal", "boardId"],
        required: false
      },
      {
        model: Board,
        as: "board",
        attributes: ["id", "name", "color", "order"],
        required: false
      },
      {
        model: DealActivity,
        as: "activities",
        required: false,
        include: [
          { model: User, as: "user", attributes: ["id", "name"], required: false }
        ]
      },
      {
        model: Ticket,
        as: "tickets",
        attributes: ["id", "status", "protocol", "lastMessage", "updatedAt"],
        required: false,
        through: { attributes: [] }
      }
    ],
    order: [[{ model: DealActivity, as: "activities" }, "createdAt", "DESC"]]
  });

  if (!deal) {
    throw new AppError("ERR_NO_DEAL_FOUND", 404);
  }

  return deal;
};

export default ShowDealService;
