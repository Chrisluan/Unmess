import { Request, Response } from "express";

import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";
import { escopoDaRequisicao, garantirNoEscopo } from "../helpers/permissions/escopoDaRequisicao";
import { alcanca } from "../helpers/permissions/escopos";
import { usuarioPode } from "../helpers/permissions/resolve";
import * as Caixa from "../services/FinanceServices/FrenteDeCaixa";
import * as Balcao from "../services/FinanceServices/VendaDeBalcao";
import * as Cadastros from "../services/FinanceServices/CadastrosFinanceiros";

/**
 * PDV — frente de caixa.
 *
 * Todas as rotas exigem `finance:pos`, menos o histórico, que exige
 * `finance:posAudit`: operar o caixa e conferir os turnos dos outros são
 * papéis diferentes, e quem fica no balcão não precisa ver a diferença de
 * fechamento de ontem do colega.
 *
 * O escopo de contas vale aqui como vale no resto do financeiro: quem só
 * alcança o caixa da loja não abre turno no caixa da fábrica.
 */

const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Os caixas em que esta pessoa pode abrir turno.
 *
 * A tela precisa da lista para o seletor de abertura, e ela é diferente da
 * lista de contas do financeiro: só as de tipo "cash" têm gaveta para contar.
 */
export const caixas = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const contas = await Cadastros.listarContas(
    getCompanyId(req),
    await escopoDaRequisicao(req, "account")
  );

  return res.json({ accounts: contas.filter(conta => conta.kind === "cash") });
};

/** O turno aberto, com o resumo da gaveta e o que já passou por ela. */
export const atual = async (req: Request, res: Response): Promise<Response> => {
  const companyId = getCompanyId(req);
  const { accountId } = req.query as Record<string, string>;

  const resumo = await Caixa.sessaoAberta(
    companyId,
    accountId ? Number(accountId) : undefined
  );

  if (!resumo) {
    return res.json({ session: null });
  }

  /**
   * Turno de um caixa fora do alcance é o mesmo que turno nenhum.
   *
   * Sem `accountId` na consulta, o serviço devolve o primeiro turno aberto da
   * empresa — que pode ser de um caixa que esta pessoa não alcança. Recusar
   * com 403 seria contar que ele existe; devolver "nenhum turno aberto" é a
   * resposta verdadeira do ponto de vista de quem perguntou.
   */
  const escopo = await escopoDaRequisicao(req, "account");

  if (!alcanca(escopo, resumo.session?.accountId)) {
    return res.json({ session: null });
  }

  const sales = await Balcao.listarVendasDaSessao(
    companyId,
    Number(resumo.session?.id)
  );

  return res.json({ ...resumo, sales });
};

export const abrir = async (req: Request, res: Response): Promise<Response> => {
  const { accountId, openingAmount } = req.body;

  if (!accountId) {
    throw new AppError("Escolha o caixa a abrir.", 400);
  }

  await garantirNoEscopo(req, "account", Number(accountId), "Este caixa");

  const resumo = await Caixa.abrir({
    companyId: getCompanyId(req),
    accountId: Number(accountId),
    userId: Number(req.user.id),
    openingAmount: numero(openingAmount)
  });

  return res.status(201).json(resumo);
};

export const fechar = async (req: Request, res: Response): Promise<Response> => {
  const { sessionId } = req.params;
  const { closingAmount, notes } = req.body;

  if (closingAmount === undefined || closingAmount === null) {
    throw new AppError("Informe quanto foi contado na gaveta.", 400);
  }

  const resumo = await Caixa.fechar({
    companyId: getCompanyId(req),
    sessionId: Number(sessionId),
    userId: Number(req.user.id),
    closingAmount: numero(closingAmount),
    notes
  });

  return res.json(resumo);
};

/** Sangria e suprimento. */
export const movimentar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { sessionId } = req.params;
  const { direction, amount, reason, counterAccountId } = req.body;

  if (direction !== "in" && direction !== "out") {
    throw new AppError(
      "O movimento precisa ser suprimento (in) ou sangria (out).",
      400
    );
  }

  const resumo = await Caixa.registrarMovimento({
    companyId: getCompanyId(req),
    sessionId: Number(sessionId),
    userId: Number(req.user.id),
    direction,
    amount: numero(amount),
    reason,
    counterAccountId: Number(counterAccountId)
  });

  return res.status(201).json(resumo);
};

export const vender = async (req: Request, res: Response): Promise<Response> => {
  const { sessionId } = req.params;
  const { items, method, discount, customerId } = req.body;

  /**
   * Desconto no balcão pede a mesma permissão que desconto no orçamento.
   *
   * Seria estranho travar o desconto na proposta e deixá-lo livre no PDV — a
   * margem é a mesma, e quem quisesse contorná-lo teria só que vender pelo
   * outro caminho.
   */
  if (numero(discount) > 0) {
    const pode = await usuarioPode(Number(req.user.id), "crm:discount");

    if (!pode) {
      throw new AppError(
        "Você não tem permissão para dar desconto. Peça a quem administra o sistema.",
        403
      );
    }
  }

  const sale = await Balcao.registrarVenda({
    companyId: getCompanyId(req),
    sessionId: Number(sessionId),
    userId: Number(req.user.id),
    items,
    method: method || "cash",
    discount: numero(discount),
    customerId: customerId ? Number(customerId) : null
  });

  const resumo = await Caixa.resumoPorSessao(
    getCompanyId(req),
    Number(sessionId)
  );

  return res.status(201).json({ sale, resumo });
};

/** Histórico de turnos — de quem confere, não de quem opera. */
export const historico = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { accountId, de, ate } = req.query as Record<string, string>;

  const escopo = await escopoDaRequisicao(req, "account");

  const sessions = await Caixa.listarSessoes({
    companyId: getCompanyId(req),
    accountId: accountId ? Number(accountId) : undefined,
    de,
    ate
  });

  // O filtro de escopo acontece depois porque a listagem já traz a conta
  // junto; consultá-la duas vezes para montar um IN não pagaria por si numa
  // lista com teto de duzentas linhas.
  return res.json({
    sessions: sessions.filter(sessao => alcanca(escopo, sessao.accountId))
  });
};
