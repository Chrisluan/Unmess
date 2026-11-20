import { Transaction } from "sequelize";

import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Board from "../../models/Board";
import Customer from "../../models/Customer";
import Deal from "../../models/Deal";
import DealActivity from "../../models/DealActivity";
import DealItem from "../../models/DealItem";
import Order from "../../models/Order";
import OrderItem from "../../models/OrderItem";
import ProximoNumeroService from "../SequenceServices/ProximoNumeroService";

interface Request {
  dealId: number;
  companyId: number;
  userId?: number;
  /**
   * Se o orçamento já tem pedido ativo, devolve esse em vez de recusar. É o
   * caso de quem clicou "Gerar pedido" e depois arrastou o card para a
   * coluna final: o arrasto não pode gerar um segundo pedido.
   */
  reaproveitar?: boolean;
}

/** Pedido que ainda vale: existe e não foi cancelado. */
export const pedidoAtivoDo = async (
  deal: Pick<Deal, "orderId">,
  companyId: number,
  transaction?: Transaction
): Promise<Order | null> => {
  if (!deal.orderId) return null;
  const pedido = await Order.findOne({
    where: { id: deal.orderId, companyId },
    transaction
  });
  return pedido && !pedido.canceledAt ? pedido : null;
};

/**
 * Gera o pedido a partir de um orçamento aprovado.
 *
 * Congela o que foi combinado: os itens são copiados para OrderItems e as
 * condições (desconto, pagamento, entrega) para o pedido. Daí em diante o
 * orçamento fica travado e produção, documento e cobrança leem do pedido.
 *
 * Exige o que a cobrança vai precisar: cliente cadastrado (não basta o
 * contato do WhatsApp -- boleto e nota pedem nome e documento) e ao menos um
 * item. Recusar aqui é melhor do que descobrir na hora de cobrar.
 *
 * Não move o card nem cria o card de produção: isso é do AdvanceDealService,
 * que chama este serviço quando o orçamento sai do funil.
 */
const GerarPedidoService = async ({
  dealId,
  companyId,
  userId,
  reaproveitar = false
}: Request): Promise<{ pedido: Order; criado: boolean }> => {
  const deal = await Deal.findOne({
    where: { id: dealId, companyId },
    include: [
      { model: Board, as: "board", attributes: ["id", "isSalesFunnel"] },
      {
        model: DealItem,
        as: "items",
        separate: true,
        order: [["position", "ASC"], ["id", "ASC"]]
      }
    ]
  });

  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  const existente = await pedidoAtivoDo(deal, companyId);
  if (existente) {
    if (reaproveitar) return { pedido: existente, criado: false };
    throw new AppError("ERR_PEDIDO_JA_GERADO", 409, {
      orderId: existente.id,
      number: existente.number
    });
  }

  if (!deal.board?.isSalesFunnel) {
    throw new AppError("ERR_PEDIDO_FORA_DO_FUNIL", 400);
  }

  const itens = (deal.items || []) as DealItem[];
  if (itens.length === 0) {
    throw new AppError("ERR_PEDIDO_SEM_ITENS", 400);
  }

  // O cliente pode já existir para o contato e só não ter sido ligado ao
  // card (o card nasceu antes do cadastro). Nesse caso liga agora.
  let customerId: number | null = deal.customerId || null;
  if (!customerId && deal.contactId) {
    const doContato = await Customer.findOne({
      where: { contactId: deal.contactId, companyId },
      attributes: ["id"]
    });
    customerId = doContato?.id ?? null;
  }
  if (!customerId) {
    throw new AppError("ERR_PEDIDO_SEM_CLIENTE", 400, {
      contactId: deal.contactId || null
    });
  }

  // Fora da transação de propósito: o contador tem a sua, e abri-la de dentro
  // desta seguraria as duas ao mesmo tempo.
  const numero = await ProximoNumeroService(companyId, "order");

  const pedido = await sequelize.transaction(async transaction => {
    const criado = await Order.create(
      {
        number: numero,
        quoteNumber: deal.quoteNumber || null,
        dealId: deal.id,
        rootDealId: deal.rootDealId || deal.id,
        title: deal.title,
        customerId,
        contactId: deal.contactId || null,
        responsibleUserId: deal.responsibleUserId || null,
        value: itens.reduce((soma, item) => soma + item.total, 0),
        discount: deal.discount || 0,
        discountType: deal.discountType || "value",
        paymentTermId: deal.paymentTermId || null,
        installments: deal.installments || null,
        paymentCondition: deal.paymentCondition || null,
        deliveryAt: deal.deliveryAt || null,
        deliveryToArrange: Boolean(deal.deliveryToArrange),
        deliveryMode: deal.deliveryMode || null,
        carrier: deal.carrier || null,
        notes: deal.notes || null,
        status: "open",
        approvedAt: new Date(),
        companyId
      } as Partial<Order>,
      { transaction }
    );

    await OrderItem.bulkCreate(
      itens.map((item, posicao) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discount: item.discount,
        width: item.width,
        height: item.height,
        pricingMode: item.pricingMode,
        minMeasure: item.minMeasure,
        notes: item.notes,
        position: posicao,
        productId: item.productId || null,
        orderId: criado.id,
        companyId
      })),
      { transaction }
    );

    await deal.update({ orderId: criado.id, customerId }, { transaction });

    // Quem compra deixa de ser lead. É o único momento em que isso é certo.
    await Customer.update(
      { status: "active" },
      { where: { id: customerId, companyId, status: "lead" }, transaction }
    );

    await DealActivity.create(
      {
        type: "order_created",
        body: `Pedido nº ${numero}`,
        dealId: deal.id,
        userId: userId || null,
        companyId
      },
      { transaction }
    );

    return criado;
  });

  return { pedido, criado: true };
};

export default GerarPedidoService;
