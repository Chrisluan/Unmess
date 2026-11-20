import * as Yup from "yup";
import { Request, Response } from "express";

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
import { usuarioPode } from "../helpers/permissions/resolve";
import { podeVerValores, respostaComValores } from "../helpers/permissions/valores";
import emitirDeal from "../libs/emitirDeal";
import PipelineStage from "../models/PipelineStage";
import Board from "../models/Board";
import {
  escopoDaRequisicao,
  garantirNoEscopo
} from "../helpers/permissions/escopoDaRequisicao";

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
  /**
   * Conversa que originou o negócio. A tela do atendimento manda só o título
   * e este id; o cliente do card vem do ticket.
   */
  ticketId?: number;
  boardId?: number;
  discount?: number;
  discountType?: string;
}

/**
 * Recusa a ação quando falta a permissão, com a frase que diz o que fazer.
 *
 * As permissões finas do funil não podem virar rota própria — desconto e
 * responsável chegam no mesmo `PUT` que o título —, então a conferência é
 * por campo, dentro do handler. A mensagem nomeia a ação, e não a permissão:
 * quem leva o 403 é o vendedor, não quem configura o sistema.
 */
const garantirPermissao = async (
  req: Request,
  permissao: string,
  oQue: string
): Promise<void> => {
  const pode = await usuarioPode(Number(req.user.id), permissao);

  if (!pode) {
    throw new AppError(
      `Você não tem permissão para ${oQue}. Peça a quem administra o sistema.`,
      403
    );
  }
};

/**
 * As duas restrições do CRM são independentes e se somam.
 *
 * "crm:viewAll" decide de quem são os cards — os meus ou os de todo mundo. O
 * escopo de quadros decide em quais quadros, e vale igual para as duas
 * respostas: quem vê o funil inteiro vê o funil inteiro dos quadros que
 * alcança, não de todos.
 */
const escopoDeQuadros = (req: Request) => escopoDaRequisicao(req, "board");

/**
 * Sem "crm:viewAll" a pessoa enxerga apenas o próprio funil, e o filtro de
 * responsável que ela mandar é ignorado — não é um erro, é a mesma lista que
 * ela já teria. Com a permissão, o filtro vale como veio.
 */
const resolveResponsavel = async (
  req: Request,
  responsibleUserId?: string
): Promise<string | undefined> => {
  const podeVerTodos = await usuarioPode(
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
    escopoDeQuadros: await escopoDeQuadros(req),
    companyId: getCompanyId(req)
  });

  return res.json(await respostaComValores(req, deals));
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
    escopoDeQuadros: await escopoDeQuadros(req),
    companyId: getCompanyId(req)
  });

  return res.json(await respostaComValores(req, resumo));
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { dealId } = req.params;

  // A conferência de escopo do card não está aqui: é o middleware
  // noEscopoDoQuadro, declarado ao lado da permissão na rota, e ele vale para
  // as quinze rotas que recebem :dealId — não só para esta.
  const deal = await ShowDealService(dealId, getCompanyId(req));

  return res.status(200).json(await respostaComValores(req, deal));
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

  // Criar card num quadro que não se alcança é a via mais direta de contornar
  // o escopo: o card nasceria lá e sumiria da vista de quem o criou.
  if (newDeal.boardId) {
    await garantirNoEscopo(req, "board", Number(newDeal.boardId), "Este quadro");
  }

  // Mesma razão do update: valor digitado por quem não o enxerga não vale.
  if (!(await podeVerValores(req))) {
    delete newDeal.value;
    delete newDeal.discount;
    delete newDeal.discountType;
  }

  const deal = await CreateDealService({
    ...newDeal,
    companyId: getCompanyId(req),
    userId: Number(req.user.id)
  });

  emitirDeal(req.user.companyId, {
    action: "create",
    deal
  });

  return res.status(200).json(await respostaComValores(req, deal));
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

  /**
   * Passar o card adiante e queimar margem são decisões de outra ordem que
   * "corrigir o título", e por isso saíram de `crm:edit`.
   *
   * A conferência é sobre o campo ter vindo, não sobre ter mudado: comparar
   * com o valor atual custaria uma consulta a mais para tratar o caso de
   * alguém reenviar o mesmo desconto — que não é um caso que valha proteger.
   */
  // Quem não vê os valores recebe `null` no lugar deles, e uma tela que reenvia
  // o que recebeu gravaria zero por cima do preço de verdade. O servidor
  // descarta o dinheiro vindo de quem não pode vê-lo, em vez de confiar que a
  // tela se lembrou de não mandar.
  if (!(await podeVerValores(req))) {
    delete dealData.value;
    delete dealData.discount;
    delete dealData.discountType;
  }

  if (dealData.responsibleUserId !== undefined) {
    await garantirPermissao(req, "crm:assign", "definir o responsável");
  }

  if (dealData.discount !== undefined || dealData.discountType !== undefined) {
    await garantirPermissao(req, "crm:discount", "dar desconto");
  }

  const deal = await UpdateDealService({
    dealData,
    dealId,
    companyId: getCompanyId(req)
  });

  emitirDeal(req.user.companyId, {
    action: "update",
    deal
  });

  return res.status(200).json(await respostaComValores(req, deal));
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

  /**
   * Mover não é encerrar.
   *
   * A rota é a mesma — arrastar o card é como se fecha uma venda no Kanban —,
   * então a separação acontece aqui, olhando a coluna de destino: coluna
   * final conclui o quadro e pode gerar cobrança; coluna de perda encerra o
   * card. Qualquer uma das duas exige `crm:close`, e as colunas de trabalho
   * seguem exigindo só `crm:move`.
   *
   * A consulta é pela coluna de destino e não pelo estado do card: é o
   * destino que decide o que a ação faz.
   */
  const destino = await PipelineStage.findOne({
    where: { id: stageId, companyId: getCompanyId(req) },
    attributes: ["id", "isFinal", "type", "boardId"]
  });

  /**
   * Concluir o funil seguindo adiante é gerar o pedido: congela o orçamento e
   * abre a produção. É a permissão de gerar pedido, não só a de fechar.
   */
  if (destino?.isFinal && gerarProximo !== false) {
    const quadro = await Board.findOne({
      where: { id: destino.boardId, companyId: getCompanyId(req) },
      attributes: ["id", "isSalesFunnel"]
    });
    if (
      quadro?.isSalesFunnel &&
      !(await usuarioPode(Number(req.user.id), "crm:generateOrder"))
    ) {
      throw new AppError(
        "Você pode concluir o orçamento, mas não gerar o pedido. Use \"Só concluir\" ou peça a quem administra o sistema.",
        403
      );
    }
  }

  if (destino?.isFinal || destino?.type === "lost") {
    const podeEncerrar = await usuarioPode(Number(req.user.id), "crm:close");

    if (!podeEncerrar) {
      throw new AppError(
        destino.type === "lost"
          ? "Você pode mover o card, mas não dar a oportunidade por perdida."
          : "Você pode mover o card, mas não fechar a venda.",
        403
      );
    }
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

  emitirDeal(req.user.companyId, {
    action: "update",
    deal
  });

  // O card que avançou some do quadro de origem e nasce no seguinte. Os dois
  // eventos precisam sair para quem está com o outro quadro aberto ver o card
  // chegar sem recarregar a página.
  if (advancedTo) {
    emitirDeal(req.user.companyId, {
      action: "create",
      deal: advancedTo
    });
  }

  return res.status(200).json(
    await respostaComValores(req, { deal, advancedTo, nextBoardName, avisoCopia })
  );
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

  emitirDeal(req.user.companyId, {
    action: "update",
    deal
  });

  return res.status(200).json(await respostaComValores(req, deal));
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { dealId } = req.params;

  await DeleteDealService(dealId, getCompanyId(req));

  emitirDeal(req.user.companyId, {
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

  // Filtrar ou ordenar por valor revela o valor mesmo com a coluna mascarada:
  // "de 5 a 6 mil" devolve cards cujo preço a pessoa acabou de descobrir.
  const verValores = await podeVerValores(req);

  const resultado = await FiltrarOportunidadesService({
    companyId: getCompanyId(req),
    boardId: q.boardId,
    escopoDeQuadros: await escopoDeQuadros(req),
    searchParam: q.searchParam,
    responsibleUserId: await resolveResponsavel(req, q.responsibleUserId),
    semResponsavel: bool(q.semResponsavel),
    stageId: q.stageId,
    customerId: q.customerId,
    origin: q.origin,
    priority: q.priority,
    serviceStatus: q.serviceStatus,
    tagIds: lista(q.tagIds),
    valorMinimo: verValores && q.valorMinimo ? Number(q.valorMinimo) : undefined,
    valorMaximo: verValores && q.valorMaximo ? Number(q.valorMaximo) : undefined,
    criadoDe: q.criadoDe,
    criadoAte: q.criadoAte,
    atrasadas: bool(q.atrasadas),
    followUpHoje: bool(q.followUpHoje),
    semInteracaoDias: q.semInteracaoDias ? Number(q.semInteracaoDias) : undefined,
    includeClosed: bool(q.includeClosed),
    ordenacao:
      !verValores && /valor|value/i.test(q.ordenacao || "") ? undefined : q.ordenacao,
    pagina: q.pagina ? Number(q.pagina) : undefined,
    porPagina: q.porPagina ? Number(q.porPagina) : undefined
  });

  return res.json(await respostaComValores(req, resultado));
};

/** Indicadores do topo do funil. */
export const indicadores = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { boardId } = req.query as Record<string, string>;

  const dados = await IndicadoresFunilService({
    companyId: getCompanyId(req),
    boardId,
    escopoDeQuadros: await escopoDeQuadros(req)
  });

  return res.json(await respostaComValores(req, dados));
};
