import { Request, Response } from "express";

import ListDealItemsService from "../services/DealItemServices/ListDealItemsService";
import SyncDealItemsService from "../services/DealItemServices/SyncDealItemsService";
import ListDealsByTicketService from "../services/DealServices/ListDealsByTicketService";
import OrdemDeServicoService from "../services/DealServices/OrdemDeServicoService";
import getCompanyId from "../helpers/GetCompanyId";
import emitirDeal from "../libs/emitirDeal";
import AppError from "../errors/AppError";
import { usuarioPode } from "../helpers/permissions/resolve";
import { podeVerValores, respostaComValores } from "../helpers/permissions/valores";
import Deal from "../models/Deal";
import ShowDealService from "../services/DealServices/ShowDealService";
import { pedidoAtivoDo } from "../services/OrderServices/GerarPedidoService";
import { alterarItensDoPedido } from "../services/OrderServices/ItensDoPedidoService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { dealId } = req.params;

  const items = await ListDealItemsService({ dealId, companyId: getCompanyId(req) });

  return res.json(await respostaComValores(req, { items }));
};

export const sync = async (req: Request, res: Response): Promise<Response> => {
  const { dealId } = req.params;
  const { items } = req.body;
  const companyId = getCompanyId(req);

  /**
   * Desconto na linha do orçamento pede `crm:discount`.
   *
   * A conferência é só quando existe desconto de verdade: sem isto, quem não
   * pode descontar não conseguiria salvar nem um orçamento com todos os
   * descontos zerados, porque a tela manda o campo em toda linha.
   */
  const temDesconto = Array.isArray(items)
    ? items.some((item: { discount?: unknown }) => Number(item?.discount) > 0)
    : false;

  if (temDesconto) {
    const pode = await usuarioPode(Number(req.user.id), "crm:discount");

    if (!pode) {
      throw new AppError(
        "Você não tem permissão para dar desconto. Peça a quem administra o sistema.",
        403
      );
    }
  }

  /**
   * Card de produção edita os itens do pedido, não os próprios (ele não tem).
   * É mexer no que o cliente aprovou: pede `crm:editOrder`, além do que a
   * rota já exige para editar itens.
   */
  const card = await Deal.findOne({ where: { id: dealId, companyId } });
  if (!card) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  // Preço de catálogo só desce com permissão própria (ver PrecificarItens).
  const podeBaixarPreco = await usuarioPode(Number(req.user.id), "crm:overridePrice");
  const pedido = await pedidoAtivoDo(card, companyId);
  if (pedido && pedido.dealId !== card.id) {
    if (!(await usuarioPode(Number(req.user.id), "crm:editOrder"))) {
      throw new AppError(
        "Você não tem permissão para alterar um pedido já gerado. Peça a quem administra o sistema.",
        403
      );
    }
    const alterado = await alterarItensDoPedido({ order: pedido, companyId, items, podeBaixarPreco });
    const cardAtualizado = await ShowDealService(card.id, companyId);
    emitirDeal(companyId, { action: "update", deal: cardAtualizado });
    return res.json(
      await respostaComValores(req, { deal: cardAtualizado, items: alterado.items })
    );
  }

  const resultado = await SyncDealItemsService({ dealId, companyId, items, podeBaixarPreco });

  // O total do negócio mudou, e o card do Kanban precisa refletir isso sem que
  // ninguém recarregue a página -- inclusive para quem está com o quadro aberto
  // em outra máquina.
  emitirDeal(companyId, {
    action: "update",
    deal: resultado.deal
  });

  return res.json(
    await respostaComValores(req, { deal: resultado.deal, items: resultado.items })
  );
};

/** Negócios ligados a uma conversa — a visão do CRM de dentro do chat. */
export const byTicket = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  const todos = await ListDealsByTicketService({
    ticketId,
    companyId: getCompanyId(req)
  });

  // Mesma regra de `noEscopoDoQuadro`: sem `crm:viewAll`, só os cards da pessoa
  // ou os que ainda não têm responsável.
  const verTodos = await usuarioPode(Number(req.user.id), "crm:viewAll");
  const deals = verTodos
    ? todos
    : todos.filter(
        d => !d.responsibleUserId || d.responsibleUserId === Number(req.user.id)
      );

  return res.json(await respostaComValores(req, { deals }));
};

/**
 * Ordem de serviço pronta para impressão.
 *
 * Responde HTML em vez de JSON porque o destino é uma aba do navegador, onde o
 * atendente imprime ou salva em PDF.
 */
export const ordemDeServico = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { dealId } = req.params;

  const html = await OrdemDeServicoService({
    dealId,
    companyId: getCompanyId(req),
    mostrarValores: await podeVerValores(req)
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // O documento reflete o pedido no momento da emissão; guardá-lo em cache faria
  // uma reimpressão sair com itens antigos.
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
};
