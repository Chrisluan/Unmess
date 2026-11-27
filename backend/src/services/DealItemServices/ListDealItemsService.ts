import DealItem from "../../models/DealItem";
import Deal from "../../models/Deal";
import AppError from "../../errors/AppError";
import { pedidoAtivoDo } from "../OrderServices/GerarPedidoService";
import { listarItensDoPedido } from "../OrderServices/ItensDoPedidoService";

interface Request {
  dealId: number | string;
  companyId: number;
}

const ListDealItemsService = async ({
  dealId,
  companyId
}: Request): Promise<DealItem[]> => {
  // Confere o negócio antes de listar: sem isto, um id de outra empresa
  // devolveria lista vazia em vez de "não encontrado", e quem tentasse
  // adivinhar saberia a diferença entre um negócio inexistente e um alheio.
  const deal = await Deal.findOne({ where: { id: dealId, companyId } });
  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  // Card de produção: os itens são os do pedido (ver ShowDealService).
  const pedido = await pedidoAtivoDo(deal, companyId);
  if (pedido && pedido.dealId !== deal.id) {
    return listarItensDoPedido(pedido.id, companyId) as unknown as Promise<DealItem[]>;
  }

  return DealItem.findAll({
    where: { dealId: deal.id, companyId },
    order: [["position", "ASC"], ["id", "ASC"]]
  });
};

export default ListDealItemsService;
