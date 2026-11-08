import AppError from "../../errors/AppError";
import Board from "../../models/Board";
import ProximoNumeroService from "../SequenceServices/ProximoNumeroService";
import Deal from "../../models/Deal";
import DealActivity from "../../models/DealActivity";
import PipelineStage from "../../models/PipelineStage";
import ShowDealService from "./ShowDealService";
import ListBoardsService from "../BoardServices/ListBoardsService";
import DealTicket from "../../models/DealTicket";
import Ticket from "../../models/Ticket";
import clienteDoTicket from "./ClienteDoTicket";

interface Request {
  title: string;
  value?: number;
  expectedCloseAt?: Date;
  notes?: string;
  stageId?: number;
  boardId?: number;
  customerId?: number;
  contactId?: number;
  responsibleUserId?: number;
  /** Conversa que originou o negócio, quando ele nasce dentro do atendimento. */
  ticketId?: number;
  companyId: number;
  userId?: number;
}

const CreateDealService = async ({
  title,
  value = 0,
  expectedCloseAt,
  notes,
  stageId,
  boardId,
  customerId,
  contactId,
  responsibleUserId,
  ticketId,
  companyId,
  userId
}: Request): Promise<Deal> => {
  /**
   * Negócio criado de dentro da conversa herda o cliente dela.
   *
   * A tela do atendimento manda só o título e o ticket — quem está no meio de
   * uma conversa não vai reescolher o cliente que já está na frente dele. Sem
   * esta herança o card nascia com contato e cliente nulos e aparecia sem
   * nome no quadro.
   */
  const ticket = ticketId
    ? await Ticket.findOne({ where: { id: ticketId, companyId } })
    : null;

  const doTicket = ticket
    ? await clienteDoTicket(ticket, companyId)
    : { contactId: null, customerId: null };

  /**
   * Sem coluna informada o card entra na primeira coluna do quadro pedido —
   * ou do primeiro quadro do fluxo, que é onde a jornada normalmente começa.
   */
  const stage = await (async () => {
    if (stageId) {
      return PipelineStage.findOne({ where: { id: stageId, companyId } });
    }

    const boards = await ListBoardsService(companyId);
    const board = boardId
      ? boards.find(item => item.id === Number(boardId))
      : boards[0];

    if (!board) return null;

    return PipelineStage.findOne({
      where: { boardId: board.id, companyId },
      order: [
        ["order", "ASC"],
        ["id", "ASC"]
      ]
    });
  })();

  if (!stage) {
    throw new AppError("ERR_NO_PIPELINE_STAGE_FOUND", 404);
  }

  // Criar direto na coluna final puliria o quadro inteiro sem passar pelo
  // fluxo; o card entra na primeira coluna do quadro nesse caso.
  const colunaDeEntrada = stage.isFinal
    ? await PipelineStage.findOne({
        where: { boardId: stage.boardId, companyId },
        order: [
          ["order", "ASC"],
          ["id", "ASC"]
        ]
      })
    : stage;

  const destino = colunaDeEntrada || stage;

  // Card novo entra no topo da coluna; os demais descem uma posição.
  await Deal.increment("order", {
    by: 1,
    where: { stageId: destino.id, companyId, status: "open" }
  });

  /**
   * Dois contadores, um para cada natureza de card.
   *
   * No funil de vendas o card é proposta, e o número é o do orçamento. Fora
   * dele é trabalho a fazer, e o número é o da ordem de produção -- o que a
   * produção escreve na etiqueta e o cliente cita no balcão.
   *
   * Os dois saem de Sequences, que conta separado para cada empresa. Antes o
   * card nascido fora do funil não recebia número nenhum, e a tela mostrava o
   * `Deals.id`: o contador da linha no banco, único para o sistema inteiro e
   * portanto compartilhado entre as empresas.
   */
  const quadro = await Board.findOne({ where: { id: destino.boardId, companyId } });
  const noFunil = Boolean(quadro?.isSalesFunnel);

  const quoteNumber = noFunil
    ? await ProximoNumeroService(companyId, "quote")
    : null;

  const orderNumber = noFunil
    ? null
    : await ProximoNumeroService(companyId, "order");

  const deal = await Deal.create({
    quoteNumber,
    orderNumber,
    title,
    value,
    expectedCloseAt: expectedCloseAt || null,
    notes,
    stageId: destino.id,
    boardId: destino.boardId,
    customerId: customerId || doTicket.customerId || null,
    contactId: contactId || doTicket.contactId || null,
    responsibleUserId: responsibleUserId || null,
    status: destino.type === "lost" ? "lost" : "open",
    order: 0,
    companyId
  });

  await DealActivity.create({
    type: "created",
    body: destino.name,
    dealId: deal.id,
    userId: userId || null,
    companyId
  });

  // O vínculo com a conversa fecha aqui. A tela ainda o reforça com uma
  // chamada própria, que passa a ser inofensiva: findOrCreate não duplica.
  if (ticket) {
    await DealTicket.findOrCreate({
      where: { dealId: deal.id, ticketId: ticket.id }
    });
  }

  return ShowDealService(deal.id, companyId);
};

export default CreateDealService;
