import { Request, Response, NextFunction } from "express";
import { Op } from "sequelize";

import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";
import { podeVerValores, respostaComValores } from "../helpers/permissions/valores";
import emitirDeal from "../libs/emitirDeal";
import Board from "../models/Board";
import Deal from "../models/Deal";
import Order from "../models/Order";
import PipelineStage from "../models/PipelineStage";
import PaymentTerm from "../models/PaymentTerm";
import noEscopoDoQuadro from "../middleware/noEscopoDoQuadro";
import MoveDealService from "../services/DealServices/MoveDealService";
import ShowDealService from "../services/DealServices/ShowDealService";
import OrdemDeServicoService from "../services/DealServices/OrdemDeServicoService";
import PropostaService from "../services/Documentos/PropostaService";
import OrdemDeProducaoService from "../services/Documentos/OrdemDeProducaoService";
import GerarPedidoService, { pedidoAtivoDo } from "../services/OrderServices/GerarPedidoService";
import CancelarPedidoService from "../services/OrderServices/CancelarPedidoService";
import { listarItensDoPedido } from "../services/OrderServices/ItensDoPedidoService";
import { situacaoFinanceira } from "../services/OrderServices/SituacaoDoPedido";
import TrilhaService from "../services/ComercialServices/TrilhaService";

const enviarDocumento = (res: Response, html: string): void => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // O documento reflete o momento da emissão; em cache, uma reimpressão
  // sairia com itens antigos.
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
};

/**
 * As rotas de pedido recebem o id do pedido, mas o escopo (quadro e
 * responsável) é o do orçamento de origem. Resolve um no outro e reaproveita
 * a mesma conferência das rotas de card.
 */
export const pedidoNoEscopo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const pedido = await Order.findOne({
    where: { id: req.params.orderId, companyId: getCompanyId(req) },
    attributes: ["id", "dealId"]
  });
  if (!pedido) throw new AppError("ERR_PEDIDO_NAO_ENCONTRADO", 404);
  req.params.dealId = String(pedido.dealId || "");
  await noEscopoDoQuadro(req, res, next);
};

/**
 * "Gerar pedido" a partir do orçamento.
 *
 * Se o funil tem coluna final, é o mesmo que arrastar o card para ela com
 * "gerar pedido": o orçamento conclui, o pedido nasce e o trabalho abre na
 * produção -- um caminho só, seja pelo botão, seja pelo arrasto. Sem coluna
 * final, gera só o pedido e marca a venda.
 */
export const gerar = async (req: Request, res: Response): Promise<Response> => {
  const { dealId } = req.params;
  const companyId = getCompanyId(req);
  const userId = Number(req.user.id);

  const deal = await Deal.findOne({ where: { id: dealId, companyId } });
  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  const board = await Board.findOne({ where: { id: deal.boardId, companyId } });
  if (!board?.isSalesFunnel) throw new AppError("ERR_PEDIDO_FORA_DO_FUNIL", 400);

  const colunaFinal = await PipelineStage.findOne({
    where: { boardId: board.id, companyId, isFinal: true, active: { [Op.not]: false } as never },
    order: [
      ["isWon", "DESC"],
      ["order", "ASC"]
    ]
  });

  let advancedTo: Deal | null = null;

  if (colunaFinal && deal.status === "open") {
    const movido = await MoveDealService({
      dealId: deal.id,
      stageId: colunaFinal.id,
      gerarProximo: true,
      companyId,
      userId
    });
    advancedTo = movido.advancedTo;
  } else {
    await GerarPedidoService({ dealId: deal.id, companyId, userId });
  }

  const atualizado = await ShowDealService(deal.id, companyId);
  emitirDeal(companyId, { action: "update", deal: atualizado });
  if (advancedTo) emitirDeal(companyId, { action: "create", deal: advancedTo });

  return res.status(200).json(
    await respostaComValores(req, { deal: atualizado, advancedTo, pedido: atualizado.pedido })
  );
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const companyId = getCompanyId(req);
  const pedido = await Order.findOne({
    where: { id: req.params.orderId, companyId },
    include: ["customer", "contact", "paymentTerm"]
  });
  if (!pedido) throw new AppError("ERR_PEDIDO_NAO_ENCONTRADO", 404);

  const [itens, financeiro] = await Promise.all([
    listarItensDoPedido(pedido.id, companyId),
    situacaoFinanceira(pedido, companyId)
  ]);

  return res.json(
    await respostaComValores(req, { pedido, items: itens, financeiro })
  );
};

export const cancelar = async (req: Request, res: Response): Promise<Response> => {
  const companyId = getCompanyId(req);
  const pedido = await CancelarPedidoService({
    orderId: req.params.orderId,
    companyId,
    userId: Number(req.user.id),
    motivo: req.body?.motivo
  });

  // O orçamento destrava e os cards de produção saem do quadro: quem está
  // com o CRM aberto precisa ver as duas coisas sem recarregar.
  const cards = await Deal.findAll({ where: { orderId: pedido.id, companyId } });
  await Promise.all(
    cards.map(async card =>
      emitirDeal(companyId, { action: "update", deal: await ShowDealService(card.id, companyId) })
    )
  );

  return res.json({ pedido });
};

/** Proposta comercial do orçamento, pronta para imprimir. */
export const proposta = async (req: Request, res: Response): Promise<void> => {
  enviarDocumento(
    res,
    await PropostaService({
      dealId: req.params.dealId,
      companyId: getCompanyId(req),
      mostrarValores: await podeVerValores(req)
    })
  );
};

/**
 * Ordem de produção. Sem preço por padrão; com `?valores=1` para quem pode
 * ver valores (a via do escritório).
 */
export const ordemDeProducao = async (req: Request, res: Response): Promise<void> => {
  const comValores = req.query.valores === "1" && (await podeVerValores(req));
  enviarDocumento(
    res,
    await OrdemDeProducaoService({
      orderId: req.params.orderId,
      companyId: getCompanyId(req),
      mostrarValores: comValores
    })
  );
};

/**
 * A rota antiga do botão "Ordem de serviço" passa a escolher o documento
 * certo: card com pedido imprime a ordem de produção do pedido; orçamento no
 * funil imprime a proposta; card antigo, sem pedido, o modelo de antes.
 */
export const documentoDoCard = async (req: Request, res: Response): Promise<void> => {
  const companyId = getCompanyId(req);
  const deal = await Deal.findOne({
    where: { id: req.params.dealId, companyId },
    include: [{ model: Board, as: "board", attributes: ["id", "isSalesFunnel"] }]
  });
  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  const mostrarValores = await podeVerValores(req);
  const pedido = await pedidoAtivoDo(deal, companyId);

  if (pedido) {
    enviarDocumento(
      res,
      await OrdemDeProducaoService({ orderId: pedido.id, companyId, mostrarValores: false })
    );
    return;
  }

  if (deal.board?.isSalesFunnel) {
    enviarDocumento(res, await PropostaService({ dealId: deal.id, companyId, mostrarValores }));
    return;
  }

  enviarDocumento(
    res,
    await OrdemDeServicoService({ dealId: deal.id, companyId, mostrarValores })
  );
};

export const trilha = async (req: Request, res: Response): Promise<Response> => {
  const numero = (valor: unknown) => (valor ? Number(valor) : undefined);
  const resultado = await TrilhaService({
    companyId: getCompanyId(req),
    dealId: numero(req.query.dealId),
    orderId: numero(req.query.orderId),
    ticketId: numero(req.query.ticketId),
    customerId: numero(req.query.customerId)
  });
  return res.json(await respostaComValores(req, resultado));
};

/**
 * Condições de pagamento ativas, só nome e id, para o orçamento escolher.
 *
 * O cadastro completo mora no financeiro e pede permissão de financeiro; quem
 * vende precisa só escolher uma da lista.
 */
export const condicoesDePagamento = async (req: Request, res: Response): Promise<Response> => {
  const condicoes = await PaymentTerm.findAll({
    where: { companyId: getCompanyId(req), active: true },
    attributes: ["id", "name"],
    order: [["name", "ASC"]]
  });
  return res.json({ condicoes });
};
