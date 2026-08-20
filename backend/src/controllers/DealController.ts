import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListDealsService from "../services/DealServices/ListDealsService";
import ShowDealService from "../services/DealServices/ShowDealService";
import CreateDealService from "../services/DealServices/CreateDealService";
import UpdateDealService from "../services/DealServices/UpdateDealService";
import MoveDealService from "../services/DealServices/MoveDealService";
import FiltrarOportunidadesService from "../services/DealServices/FiltrarOportunidadesService";
import IndicadoresFunilService from "../services/DealServices/IndicadoresFunilService";
import { descreverMotivo } from "../helpers/MotivosDePerda";
import DeleteDealService from "../services/DealServices/DeleteDealService";
import LinkDealTicketService from "../services/DealServices/LinkDealTicketService";
import ShowPipelineSummaryService from "../services/DealServices/ShowPipelineSummaryService";
import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";
import { userHasPermission } from "../helpers/permissions/GetUserPermissions";

type IndexQuery = {
  searchParam: string;
  responsibleUserId: string;
  customerId: string;
  includeClosed: string;
  boardId: string;
};

interface DealData {
  title: string;
  value?: number;
  expectedCloseAt?: Date;
  notes?: string;
  stageId?: number;
  customerId?: number;
  contactId?: number;
  responsibleUserId?: number;
  lostReason?: string;
}

/**
 * Sem "crm:viewAll" a pessoa enxerga apenas o próprio funil, e o filtro de
 * responsável que ela mandar é ignorado — não é um erro, é a mesma lista que
 * ela já teria. Com a permissão, o filtro vale como veio.
 */
const resolveResponsavel = async (
  req: Request,
  responsibleUserId?: string
): Promise<string | undefined> => {
  const podeVerTodos = await userHasPermission(
    Number(req.user.id),
    "crm:viewAll"
  );

  return podeVerTodos ? responsibleUserId : String(req.user.id);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, responsibleUserId, customerId, includeClosed, boardId } =
    req.query as IndexQuery;

  const deals = await ListDealsService({
    searchParam,
    responsibleUserId: await resolveResponsavel(req, responsibleUserId),
    customerId,
    includeClosed: includeClosed === "true",
    boardId,
    companyId: getCompanyId(req)
  });

  return res.json(deals);
};

/**
 * Totais do funil para o cabeçalho do board.
 */
export const summary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { responsibleUserId } = req.query as IndexQuery;

  const resumo = await ShowPipelineSummaryService({
    responsibleUserId: await resolveResponsavel(req, responsibleUserId),
    companyId: getCompanyId(req)
  });

  return res.json(resumo);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { dealId } = req.params;

  const deal = await ShowDealService(dealId, getCompanyId(req));

  return res.status(200).json(deal);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newDeal: DealData = req.body;

  const schema = Yup.object().shape({
    title: Yup.string().required(),
    value: Yup.number().min(0)
  });

  try {
    await schema.validate(newDeal);
  } catch (err) {
    throw new AppError(err.message);
  }

  const deal = await CreateDealService({
    ...newDeal,
    companyId: getCompanyId(req),
    userId: Number(req.user.id)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("deal", {
    action: "create",
    deal
  });

  return res.status(200).json(deal);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const dealData: DealData = req.body;

  const schema = Yup.object().shape({
    title: Yup.string(),
    value: Yup.number().min(0)
  });

  try {
    await schema.validate(dealData);
  } catch (err) {
    throw new AppError(err.message);
  }

  const { dealId } = req.params;

  const deal = await UpdateDealService({
    dealData,
    dealId,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("deal", {
    action: "update",
    deal
  });

  return res.status(200).json(deal);
};

/**
 * Arrastar o card no Kanban.
 */
export const move = async (req: Request, res: Response): Promise<Response> => {
  const { dealId } = req.params;
  const { stageId, order, lostReason, lostReasonDetail, gerarProximo } = req.body;

  if (!stageId) {
    throw new AppError("ERR_NO_PIPELINE_STAGE_FOUND", 404);
  }

  const { deal, advancedTo, nextBoardName, avisoCopia } = await MoveDealService({
    dealId,
    stageId,
    order,
    // O motivo pode vir da lista, digitado, ou os dois: o texto final grava o
    // rótulo por extenso para não exigir decodificador na leitura.
    lostReason: descreverMotivo(lostReason, lostReasonDetail) || undefined,
    // Quem arrastou decide se abre o card no quadro seguinte. Ausente vira
    // true para não quebrar chamadas antigas que não mandavam o campo.
    gerarProximo: gerarProximo !== false,
    companyId: getCompanyId(req),
    userId: Number(req.user.id)
  });

  const io = getIO();

  io.to(`company-${req.user.companyId}`).emit("deal", {
    action: "update",
    deal
  });

  // O card que avançou some do quadro de origem e nasce no seguinte. Os dois
  // eventos precisam sair para quem está com o outro quadro aberto ver o card
  // chegar sem recarregar a página.
  if (advancedTo) {
    io.to(`company-${req.user.companyId}`).emit("deal", {
      action: "create",
      deal: advancedTo
    });
  }

  return res.status(200).json({ deal, advancedTo, nextBoardName, avisoCopia });
};

export const linkTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { dealId } = req.params;
  const { ticketId, link } = req.body;

  const deal = await LinkDealTicketService({
    dealId,
    ticketId,
    link,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("deal", {
    action: "update",
    deal
  });

  return res.status(200).json(deal);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { dealId } = req.params;

  await DeleteDealService(dealId, getCompanyId(req));

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("deal", {
    action: "delete",
    dealId
  });

  return res.status(200).json({ message: "Deal deleted" });
};

/**
 * Busca de oportunidades com os filtros do funil.
 *
 * Separada do index antigo, que o Kanban usa hoje: trocar aquele endpoint
 * quebraria a tela em produção enquanto esta parte ainda está sendo montada.
 */
export const buscar = async (req: Request, res: Response): Promise<Response> => {
  const q = req.query as Record<string, string>;

  const lista = (valor?: string) =>
    valor ? valor.split(",").map(Number).filter(Number.isFinite) : undefined;

  const bool = (valor?: string) => valor === "true" || valor === "1";

  const resultado = await FiltrarOportunidadesService({
    companyId: getCompanyId(req),
    boardId: q.boardId,
    searchParam: q.searchParam,
    responsibleUserId: q.responsibleUserId,
    semResponsavel: bool(q.semResponsavel),
    stageId: q.stageId,
    customerId: q.customerId,
    origin: q.origin,
    priority: q.priority,
    serviceStatus: q.serviceStatus,
    tagIds: lista(q.tagIds),
    valorMinimo: q.valorMinimo ? Number(q.valorMinimo) : undefined,
    valorMaximo: q.valorMaximo ? Number(q.valorMaximo) : undefined,
    criadoDe: q.criadoDe,
    criadoAte: q.criadoAte,
    atrasadas: bool(q.atrasadas),
    followUpHoje: bool(q.followUpHoje),
    semInteracaoDias: q.semInteracaoDias ? Number(q.semInteracaoDias) : undefined,
    includeClosed: bool(q.includeClosed),
    ordenacao: q.ordenacao,
    pagina: q.pagina ? Number(q.pagina) : undefined,
    porPagina: q.porPagina ? Number(q.porPagina) : undefined
  });

  return res.json(resultado);
};

/** Indicadores do topo do funil. */
export const indicadores = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { boardId } = req.query as Record<string, string>;

  const dados = await IndicadoresFunilService({
    companyId: getCompanyId(req),
    boardId
  });

  return res.json(dados);
};
