import Deal from "../../models/Deal";
import DealItem from "../../models/DealItem";
import DealTicket from "../../models/DealTicket";
import PipelineStage from "../../models/PipelineStage";
import Board from "../../models/Board";
import Customer from "../../models/Customer";
import Order from "../../models/Order";

interface Request {
  ticketId: number | string;
  companyId: number;
}

/**
 * Os negócios ligados a uma conversa.
 *
 * É a visão que faltava para o atendimento: o CRM já sabia quais conversas
 * pertencem a um negócio, mas quem está no chat precisa do contrário -- ver, sem
 * sair da conversa, o que já foi orçado para aquele cliente.
 *
 * Traz os itens junto de propósito: o painel mostra o pedido aberto com suas
 * linhas, e buscá-las depois faria a tela piscar duas vezes a cada troca de
 * conversa.
 */
const ListDealsByTicketService = async ({
  ticketId,
  companyId
}: Request): Promise<Deal[]> => {
  const vinculos = await DealTicket.findAll({ where: { ticketId } });
  const ids = vinculos.map(v => v.dealId);

  if (!ids.length) return [];

  return Deal.findAll({
    where: { id: ids, companyId },
    include: [
      {
        model: DealItem,
        as: "items",
        required: false,
        separate: true,
        order: [["position", "ASC"], ["id", "ASC"]]
      },
      { model: PipelineStage, as: "stage", attributes: ["id", "name", "color"] },
      { model: Board, as: "board", attributes: ["id", "name", "isSalesFunnel"] },
      { model: Customer, as: "customer", attributes: ["id", "name"] },
      // Distingue orçamento de pedido no painel do chat: existe só depois de o
      // card sair do funil de vendas.
      {
        model: Order,
        as: "salesOrder",
        attributes: ["id", "number", "quoteNumber", "status"],
        required: false
      }
    ],
    // Arquivados no fim: um card que já avançou de quadro continua no histórico,
    // mas quem está atendendo quer ver primeiro o que está em aberto.
    order: [["archivedAt", "ASC"], ["createdAt", "DESC"]]
  });
};

export default ListDealsByTicketService;
