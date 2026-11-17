import { Op, WhereOptions } from "sequelize";

import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import DealTicket from "../../models/DealTicket";
import Message from "../../models/Message";

interface Request {
  dealId: number | string;
  companyId: number;
  limite?: number;
}

export interface MidiaDaConversa {
  id: string;
  mediaUrl: string | null;
  mediaType: string;
  body: string;
  fromMe: boolean;
  createdAt: Date;
  /** Já trazido para o material deste pedido. */
  jaImportada: boolean;
}

/**
 * As mídias das conversas ligadas a um pedido.
 *
 * É o outro caminho para o material chegar: na maioria dos pedidos a arte já
 * está no WhatsApp, e obrigar o atendente a baixar do chat para subir aqui de
 * novo garantiria que ninguém fizesse.
 *
 * Só o que tem anexo, do mais recente para trás: a arte aprovada costuma ser
 * das últimas coisas que chegaram.
 */
const ListarMidiasDaConversaService = async ({
  dealId,
  companyId,
  limite = 60
}: Request): Promise<MidiaDaConversa[]> => {
  const deal = await Deal.findOne({
    where: { id: dealId, companyId },
    include: [{ association: "attachments", required: false }]
  });

  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  const vinculos = await DealTicket.findAll({ where: { dealId: deal.id } });
  const ticketIds = vinculos.map(v => v.ticketId);

  if (!ticketIds.length) return [];

  const mensagens = await Message.findAll({
    // O cast existe porque a tipagem desta versão do Sequelize não aceita null
    // em Op.not; é o mesmo recurso usado nas métricas do painel.
    where: {
      ticketId: { [Op.in]: ticketIds },
      mediaUrl: { [Op.not]: null }
    } as WhereOptions,
    order: [["createdAt", "DESC"]],
    limit: limite
  });

  // O que já foi importado continua na lista, marcado: sumir da grade faria
  // parecer que a mídia se perdeu da conversa.
  const importadas = new Set(
    (deal.attachments || [])
      .map(anexo => anexo.sourceMessageId)
      .filter(Boolean)
  );

  return mensagens.map(mensagem => ({
    id: mensagem.id,
    mediaUrl: mensagem.mediaUrl,
    mediaType: mensagem.mediaType,
    body: mensagem.body,
    fromMe: mensagem.fromMe,
    createdAt: mensagem.createdAt,
    jaImportada: importadas.has(mensagem.id)
  }));
};

export default ListarMidiasDaConversaService;
