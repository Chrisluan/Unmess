import { Request, Response, NextFunction, RequestHandler } from "express";

import AppError from "../errors/AppError";
import Deal from "../models/Deal";
import getCompanyId from "../helpers/GetCompanyId";
import { escopoDaRequisicao } from "../helpers/permissions/escopoDaRequisicao";
import { alcanca } from "../helpers/permissions/escopos";
import { usuarioPode } from "../helpers/permissions/resolve";

/**
 * O card desta rota está num quadro que quem pediu alcança?
 *
 * Vai depois de hasPermission, em toda rota que recebe `:dealId`.
 *
 * Existe como middleware, e não como três linhas dentro de cada handler,
 * porque são quinze rotas em três controllers — items, anexos, ordem de
 * serviço, capa — e a décima sexta seria escrita por alguém que não leu esta
 * lista. Escondido na listagem e aberto pelo id é o formato clássico dessa
 * falha: o filtro da tela vira enfeite e basta o número na URL.
 *
 * Fica ao lado da permissão na declaração da rota de propósito. As duas
 * respondem à mesma pergunta em dimensões diferentes — "pode?" e "sobre o
 * quê?" —, e ler uma sem a outra dá uma ideia errada do que a rota protege.
 */
const noEscopoDoQuadro: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const { dealId } = req.params;

  if (!dealId) {
    next();
    return;
  }

  const deal = await Deal.findOne({
    where: { id: dealId, companyId: getCompanyId(req) },
    attributes: ["id", "boardId", "responsibleUserId"]
  });

  // Card inexistente é assunto do handler, que tem a mensagem certa para cada
  // caso. Aqui só não se pode deixar passar um card que existe e não deveria
  // ser alcançado.
  if (!deal) {
    next();
    return;
  }

  const escopo = await escopoDaRequisicao(req, "board");

  if (!alcanca(escopo, deal.boardId)) {
    throw new AppError(
      "Este quadro não está no seu acesso. Peça a quem administra o sistema " +
        "para incluí-lo.",
      403
    );
  }

  /**
   * E de quem é o card.
   *
   * `crm:view` promete "vê as oportunidades sob sua responsabilidade", e a
   * listagem cumpre — mas abrir o card pelo id não conferia o responsável, e
   * bastava o número na URL para ler (e mexer em) o negócio de outra pessoa.
   * Card sem responsável fica aberto: é a fila de quem ainda não foi atribuído.
   */
  if (
    deal.responsibleUserId &&
    deal.responsibleUserId !== Number(req.user.id) &&
    !(await usuarioPode(Number(req.user.id), "crm:viewAll"))
  ) {
    throw new AppError(
      "Esta oportunidade é de outra pessoa. Peça a quem administra o sistema " +
        "acesso a todas as oportunidades, ou ao responsável que a repasse.",
      403
    );
  }

  next();
};

export default noEscopoDoQuadro;
