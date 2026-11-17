import Deal from "../../models/Deal";
import Customer from "../../models/Customer";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Board from "../../models/Board";
import PipelineStage from "../../models/PipelineStage";
import DealActivity from "../../models/DealActivity";
import DealItem from "../../models/DealItem";
import Order from "../../models/Order";
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
        attributes: ["id", "name", "color", "type", "isFinal", "isWon", "boardId"],
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
        // Os itens vêm junto porque a ficha abre direto neles: buscá-los à
        // parte faria a janela abrir com o total zerado e corrigir depois.
        model: DealItem,
        as: "items",
        required: false,
        separate: true,
        order: [["position", "ASC"], ["id", "ASC"]]
      },
      {
        model: Ticket,
        as: "tickets",
        attributes: ["id", "status", "protocol", "lastMessage", "updatedAt"],
        required: false,
        through: { attributes: [] },
        include: [
          { model: Contact, as: "contact", attributes: ["id", "name", "number"], required: false },
          { model: User, as: "user", attributes: ["id", "name"], required: false }
        ]
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
