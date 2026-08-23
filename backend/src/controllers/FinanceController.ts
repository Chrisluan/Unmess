import { Request, Response } from "express";

import getCompanyId from "../helpers/GetCompanyId";
import ProporCobrancaService from "../services/FinanceServices/ProporCobrancaService";
import GerarCobrancaService from "../services/FinanceServices/GerarCobrancaService";
import ListReceivablesService from "../services/FinanceServices/ListReceivablesService";
import ListarPendentesDeCobrancaService from "../services/FinanceServices/ListarPendentesDeCobrancaService";
import RegistrarRecebimentoService from "../services/FinanceServices/RegistrarRecebimentoService";
import EstornarLancamentoService from "../services/FinanceServices/EstornarLancamentoService";
import CancelarCobrancaService from "../services/FinanceServices/CancelarCobrancaService";
import FluxoDeCaixaService from "../services/FinanceServices/FluxoDeCaixaService";
import * as Cadastros from "../services/FinanceServices/CadastrosFinanceiros";
import * as Pagar from "../services/FinanceServices/ContasAPagar";

// ── Contas a receber ────────────────────────────────────────────────────────

export const listarReceber = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const {
    situacao,
    vencimentoDe,
    vencimentoAte,
    customerId,
    searchParam,
    pagina,
    porPagina
  } = req.query as Record<string, string>;

  const resultado = await ListReceivablesService({
    companyId: getCompanyId(req),
    situacao,
    vencimentoDe,
    vencimentoAte,
    customerId,
    searchParam,
    pagina: Number(pagina) || 1,
    porPagina: Number(porPagina) || 50
  });

  return res.json(resultado);
};

/** A fila de vendas faturadas que ainda não viraram cobrança. */
export const pendentes = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const deals = await ListarPendentesDeCobrancaService({
    companyId: getCompanyId(req)
  });

  return res.json({ deals });
};

/** Calcula as parcelas sem gravar — é o que a tela mostra para confirmar. */
export const propor = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { dealId } = req.params;
  const { paymentTermId } = req.query as Record<string, string>;

  const proposta = await ProporCobrancaService({
    dealId,
    companyId: getCompanyId(req),
    paymentTermId
  });

  return res.json(proposta);
};

export const gerar = async (req: Request, res: Response): Promise<Response> => {
  const { dealId, parcelas, descricao, customerId, paymentTermId, categoryId, notes } =
    req.body;

  const receivables = await GerarCobrancaService({
    dealId,
    companyId: getCompanyId(req),
    parcelas,
    descricao,
    customerId,
    paymentTermId,
    categoryId,
    notes
  });

  return res.status(201).json({ receivables });
};

export const receber = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { receivableId } = req.params;
  const { accountId, amount, occurredAt, method, description } = req.body;

  const entry = await RegistrarRecebimentoService({
    receivableId,
    companyId: getCompanyId(req),
    accountId,
    amount,
    occurredAt,
    method,
    description,
    userId: Number(req.user.id)
  });

  return res.status(201).json({ entry });
};

export const estornar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { entryId } = req.params;

  await EstornarLancamentoService({
    entryId,
    companyId: getCompanyId(req)
  });

  return res.json({ message: "Entry reversed" });
};

export const cancelarCobranca = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { receivableId } = req.params;
  const { reason } = req.body;

  const receivable = await CancelarCobrancaService({
    receivableId,
    companyId: getCompanyId(req),
    reason
  });

  return res.json({ receivable });
};

// ── Contas a pagar ──────────────────────────────────────────────────────────

export const listarPagar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { situacao, vencimentoDe, vencimentoAte, supplierId, searchParam, pagina, porPagina } =
    req.query as Record<string, string>;

  const resultado = await Pagar.listarPagar({
    companyId: getCompanyId(req),
    situacao,
    vencimentoDe,
    vencimentoAte,
    supplierId,
    searchParam,
    pagina: Number(pagina) || 1,
    porPagina: Number(porPagina) || 50
  });

  return res.json(resultado);
};

export const criarPagar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const payables = await Pagar.criarPagar({
    ...req.body,
    companyId: getCompanyId(req)
  });

  return res.status(201).json({ payables });
};

export const pagarConta = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { payableId } = req.params;
  const { accountId, amount, occurredAt, method, description } = req.body;

  const entry = await Pagar.pagar({
    payableId,
    companyId: getCompanyId(req),
    accountId,
    amount,
    occurredAt,
    method,
    description,
    userId: Number(req.user.id)
  });

  return res.status(201).json({ entry });
};

export const cancelarPagar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const payable = await Pagar.cancelarPagar(
    req.params.payableId,
    getCompanyId(req),
    req.body?.reason
  );

  return res.json({ payable });
};

export const listarFornecedores = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const suppliers = await Pagar.listarFornecedores(getCompanyId(req));
  return res.json({ suppliers });
};

export const salvarFornecedor = async (req: Request, res: Response): Promise<Response> =>
  res.json(await Pagar.salvarFornecedor(getCompanyId(req), req.body));

export const removerFornecedor = async (req: Request, res: Response): Promise<Response> => {
  await Pagar.removerFornecedor(getCompanyId(req), req.params.id);
  return res.json({ message: "Supplier removed" });
};

// ── Caixa ───────────────────────────────────────────────────────────────────

export const fluxoDeCaixa = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { de, ate } = req.query as Record<string, string>;

  // Sem período informado, o mês corrente: é a pergunta que quase sempre se faz.
  const hoje = new Date();
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const fluxo = await FluxoDeCaixaService({
    companyId: getCompanyId(req),
    de: de || primeiro.toISOString().slice(0, 10),
    ate: ate || ultimo.toISOString().slice(0, 10)
  });

  return res.json(fluxo);
};

// ── Cadastros de apoio ──────────────────────────────────────────────────────

export const listarCadastros = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = getCompanyId(req);

  // Numa chamada só: a tela precisa dos quatro ao abrir, e quatro requisições
  // fariam os seletores aparecerem vazios um de cada vez.
  const [paymentTerms, accounts, categories, suppliers] = await Promise.all([
    Cadastros.listarCondicoes(companyId),
    Cadastros.listarContas(companyId),
    Cadastros.listarCategorias(companyId),
    Pagar.listarFornecedores(companyId)
  ]);

  return res.json({ paymentTerms, accounts, categories, suppliers });
};

export const salvarCondicao = async (req: Request, res: Response): Promise<Response> =>
  res.json(await Cadastros.salvarCondicao(getCompanyId(req), req.body));

export const removerCondicao = async (req: Request, res: Response): Promise<Response> => {
  await Cadastros.removerCondicao(getCompanyId(req), req.params.id);
  return res.json({ message: "Payment term removed" });
};

export const salvarConta = async (req: Request, res: Response): Promise<Response> =>
  res.json(await Cadastros.salvarConta(getCompanyId(req), req.body));

export const removerConta = async (req: Request, res: Response): Promise<Response> => {
  await Cadastros.removerConta(getCompanyId(req), req.params.id);
  return res.json({ message: "Account removed" });
};

export const salvarCategoria = async (req: Request, res: Response): Promise<Response> =>
  res.json(await Cadastros.salvarCategoria(getCompanyId(req), req.body));

export const removerCategoria = async (req: Request, res: Response): Promise<Response> => {
  await Cadastros.removerCategoria(getCompanyId(req), req.params.id);
  return res.json({ message: "Category removed" });
};
