import { Request, Response } from "express";

import ListDealItemsService from "../services/DealItemServices/ListDealItemsService";
import SyncDealItemsService from "../services/DealItemServices/SyncDealItemsService";
import ListDealsByTicketService from "../services/DealServices/ListDealsByTicketService";
import OrdemDeServicoService from "../services/DealServices/OrdemDeServicoService";
import getCompanyId from "../helpers/GetCompanyId";
import { getIO } from "../libs/socket";
import { companyRoom } from "../libs/socketRooms";
import AppError from "../errors/AppError";
import { usuarioPode } from "../helpers/permissions/resolve";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { dealId } = req.params;

  const items = await ListDealItemsService({ dealId, companyId: getCompanyId(req) });

  return res.json({ items });
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

  const resultado = await SyncDealItemsService({ dealId, companyId, items });

  // O total do negócio mudou, e o card do Kanban precisa refletir isso sem que
  // ninguém recarregue a página -- inclusive para quem está com o quadro aberto
  // em outra máquina.
  const io = getIO();
  io.to(companyRoom(companyId)).emit("deal", {
    action: "update",
    deal: resultado.deal
  });

  return res.json({ deal: resultado.deal, items: resultado.items });
};

/** Negócios ligados a uma conversa — a visão do CRM de dentro do chat. */
export const byTicket = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  const deals = await ListDealsByTicketService({
    ticketId,
    companyId: getCompanyId(req)
  });

  return res.json({ deals });
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
    companyId: getCompanyId(req)
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // O documento reflete o pedido no momento da emissão; guardá-lo em cache faria
  // uma reimpressão sair com itens antigos.
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
};
