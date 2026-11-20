import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import valorLiquidoDoNegocio from "../../helpers/ValorLiquidoDoNegocio";
import Board from "../../models/Board";
import Contact from "../../models/Contact";
import Customer from "../../models/Customer";
import Deal from "../../models/Deal";
import DealTicket from "../../models/DealTicket";
import FinancialEntry from "../../models/FinancialEntry";
import Order from "../../models/Order";
import PipelineStage from "../../models/PipelineStage";
import Receivable from "../../models/Receivable";
import Ticket from "../../models/Ticket";
import { situacaoFinanceira } from "../OrderServices/SituacaoDoPedido";

interface Request {
  companyId: number;
  dealId?: number;
  orderId?: number;
  ticketId?: number;
  customerId?: number;
}

/**
 * A trilha comercial: Contato → Cliente → Conversas → Orçamentos → Pedidos →
 * Cobranças, a partir de qualquer ponto dela.
 *
 * Existe porque cada pedaço morava numa tela: a conversa não sabia do pedido,
 * o pedido não sabia da cobrança, e a cobrança não dizia de qual venda era.
 * Daqui a tela desenha o caminho inteiro, com o estado de cada etapa e o link
 * para cada uma.
 *
 * A partir de um card, de um pedido ou de uma conversa, a trilha é a daquela
 * venda. A partir do cliente, é a de todas as vendas dele.
 */
const TrilhaService = async ({
  companyId,
  dealId,
  orderId,
  ticketId,
  customerId
}: Request) => {
  let raizes: number[] = [];
  let clienteId: number | null = customerId || null;
  let contatoId: number | null = null;

  if (dealId) {
    const deal = await Deal.findOne({ where: { id: dealId, companyId } });
    if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);
    raizes = [deal.rootDealId || deal.id];
    clienteId = clienteId || deal.customerId || null;
    contatoId = deal.contactId || null;
  } else if (orderId) {
    const pedido = await Order.findOne({ where: { id: orderId, companyId } });
    if (!pedido) throw new AppError("ERR_PEDIDO_NAO_ENCONTRADO", 404);
    raizes = [pedido.rootDealId || pedido.dealId].filter(Boolean) as number[];
    clienteId = clienteId || pedido.customerId || null;
    contatoId = pedido.contactId || null;
  } else if (ticketId) {
    const ticket = await Ticket.findOne({ where: { id: ticketId, companyId } });
    if (!ticket) throw new AppError("ERR_NO_TICKET_FOUND", 404);
    contatoId = ticket.contactId;
    const vinculos = await DealTicket.findAll({ where: { ticketId } });
    const cards = vinculos.length
      ? await Deal.findAll({
          where: { id: { [Op.in]: vinculos.map(v => v.dealId) }, companyId },
          attributes: ["id", "rootDealId", "customerId"]
        })
      : [];
    raizes = Array.from(new Set(cards.map(c => c.rootDealId || c.id)));
    clienteId = clienteId || cards.find(c => c.customerId)?.customerId || null;
  }

  const cliente = clienteId
    ? await Customer.findOne({
        where: { id: clienteId, companyId },
        attributes: ["id", "name", "tradeName", "document", "status", "contactId"]
      })
    : contatoId
      ? await Customer.findOne({
          where: { contactId: contatoId, companyId },
          attributes: ["id", "name", "tradeName", "document", "status", "contactId"]
        })
      : null;

  contatoId = contatoId || cliente?.contactId || null;

  // A partir do cliente, todas as vendas dele.
  if (customerId) {
    const cards = await Deal.findAll({
      where: { companyId, customerId },
      attributes: ["id", "rootDealId"]
    });
    raizes = Array.from(new Set(cards.map(c => c.rootDealId || c.id)));
  }

  const contato = contatoId
    ? await Contact.findOne({
        where: { id: contatoId, companyId },
        attributes: ["id", "name", "number", "profilePicUrl"]
      })
    : null;

  // Orçamentos: o primeiro card de cada jornada (o que nasceu no funil).
  const orcamentos = raizes.length
    ? await Deal.findAll({
        where: { id: { [Op.in]: raizes }, companyId },
        include: [
          { model: Board, as: "board", attributes: ["id", "name", "isSalesFunnel"] },
          { model: PipelineStage, as: "stage", attributes: ["id", "name"] }
        ],
        order: [["createdAt", "DESC"]]
      })
    : [];

  const pedidos = raizes.length
    ? await Order.findAll({
        where: {
          companyId,
          [Op.or]: [{ rootDealId: { [Op.in]: raizes } }, { dealId: { [Op.in]: raizes } }]
        },
        order: [["createdAt", "DESC"]]
      })
    : [];

  // Onde cada pedido está na produção: o card aberto mais recente dele.
  const cardsDeProducao = pedidos.length
    ? await Deal.findAll({
        where: {
          companyId,
          orderId: { [Op.in]: pedidos.map(p => p.id) },
          id: { [Op.notIn]: raizes }
        },
        include: [
          { model: Board, as: "board", attributes: ["id", "name"] },
          { model: PipelineStage, as: "stage", attributes: ["id", "name"] }
        ],
        order: [["createdAt", "DESC"]]
      })
    : [];

  const conversas = contatoId
    ? await Ticket.findAll({
        where: { companyId, contactId: contatoId },
        attributes: ["id", "status", "updatedAt", "lastMessage"],
        order: [["updatedAt", "DESC"]],
        limit: 10
      })
    : [];

  const cobrancas = pedidos.length || raizes.length
    ? await Receivable.findAll({
        where: {
          companyId,
          [Op.or]: [
            ...(pedidos.length ? [{ orderId: { [Op.in]: pedidos.map(p => p.id) } }] : []),
            ...(raizes.length ? [{ dealId: { [Op.in]: raizes } }] : [])
          ]
        },
        include: [{ model: FinancialEntry, as: "entries", attributes: ["amount"] }],
        order: [["dueDate", "ASC"]]
      })
    : [];

  return {
    contato: contato
      ? { id: contato.id, name: contato.name, number: contato.number }
      : null,
    cliente: cliente
      ? {
          id: cliente.id,
          name: cliente.tradeName || cliente.name,
          document: cliente.document,
          status: cliente.status
        }
      : null,
    conversas: conversas.map(t => ({ id: t.id, status: t.status, updatedAt: t.updatedAt })),
    orcamentos: orcamentos.map(o => ({
      id: o.id,
      number: o.quoteNumber || null,
      title: o.title,
      value: valorLiquidoDoNegocio(o),
      status: o.status,
      wonAt: o.wonAt,
      validUntil: o.validUntil,
      etapa: o.stage?.name || null,
      quadro: o.board?.name || null,
      orderId: o.orderId || null
    })),
    pedidos: await Promise.all(
      pedidos.map(async p => {
        const fin = await situacaoFinanceira(p, companyId);
        const card = cardsDeProducao.find(c => c.orderId === p.id && c.status === "open")
          || cardsDeProducao.find(c => c.orderId === p.id);
        return {
          id: p.id,
          number: p.number,
          quoteNumber: p.quoteNumber,
          dealId: p.dealId,
          title: p.title,
          total: fin.total,
          faturado: fin.faturado,
          recebido: fin.recebido,
          situacao: fin.situacao,
          canceledAt: p.canceledAt,
          producao: card
            ? { dealId: card.id, quadro: card.board?.name || null, etapa: card.stage?.name || null }
            : null
        };
      })
    ),
    cobrancas: cobrancas.map(r => ({
      id: r.id,
      orderId: r.orderId,
      installment: r.installment,
      installments: r.installments,
      dueDate: r.dueDate,
      amount: r.amount,
      paidAmount: r.paidAmount,
      status: r.status
    }))
  };
};

export default TrilhaService;
