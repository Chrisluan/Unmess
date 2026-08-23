import { Request, Response } from "express";

import AppError from "../errors/AppError";
import AlterarAcessoService from "../services/CompanyServices/AlterarAcessoService";
import ListCompanyUsersService from "../services/CompanyServices/ListCompanyUsersService";
import UpdateCompanyUserService from "../services/CompanyServices/UpdateCompanyUserService";
import ListRolesService from "../services/AccessServices/ListRolesService";
import { resolverAcessoDoUsuario } from "../helpers/permissions/resolve";
import EmitirFaturaService from "../services/BillingServices/EmitirFaturaService";
import ListarFaturasService from "../services/BillingServices/ListarFaturasService";
import ProcessarWebhookAsaas from "../services/BillingServices/ProcessarWebhookAsaas";
import {
  baixarFatura,
  cancelarFatura,
  estornarFatura,
  sincronizarFatura
} from "../services/BillingServices/GerenciarFaturaService";
import { emissaoAutomaticaDisponivel } from "../services/BillingServices";
import { logger } from "../utils/logger";

/** Usuários de uma empresa — só o super chega aqui. */
export const usuarios = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.params;
  const users = await ListCompanyUsersService({ companyId: Number(companyId) });
  return res.json(users);
};

/** Cargos cadastrados na empresa, para o seletor do painel do super. */
export const cargos = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.params;
  const lista = await ListRolesService(Number(companyId));
  return res.json(lista);
};

/**
 * Cargo e permissões de um usuário da empresa.
 *
 * Devolve o usuário já com as permissões resolvidas para a tela não precisar
 * de uma segunda chamada logo depois de salvar — é o mesmo dado que ela
 * acabou de mudar.
 */
export const alterarUsuario = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, userId } = req.params;
  const { roleId, exceptions } = req.body;

  const user = await UpdateCompanyUserService({
    companyId: Number(companyId),
    userId: Number(userId),
    roleId:
      roleId === "" || roleId === null
        ? null
        : roleId !== undefined
        ? Number(roleId)
        : undefined,
    exceptions
  });

  const acesso = await resolverAcessoDoUsuario(user.id);

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    roleId: user.roleId,
    ...acesso
  });
};

/** Bloquear, suspender ou liberar o acesso da empresa inteira. */
export const alterarAcesso = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.params;
  const { status, reason, encerrarSessoes } = req.body;

  const company = await AlterarAcessoService({
    companyId: Number(companyId),
    status,
    reason,
    encerrarSessoes
  });

  return res.json(company);
};

export const listarFaturas = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.params;
  const dados = await ListarFaturasService({ companyId: Number(companyId) });

  return res.json({
    ...dados,
    // A tela precisa saber se o botão "emitir" fala com o gateway ou apenas
    // registra: são duas promessas diferentes para o mesmo clique.
    emissaoAutomatica: emissaoAutomaticaDisponivel()
  });
};

export const emitirFatura = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.params;
  const {
    amount,
    dueDate,
    description,
    billingType,
    manual,
    digitableLine,
    bankSlipUrl,
    notes
  } = req.body;

  const invoice = await EmitirFaturaService({
    companyId: Number(companyId),
    amount: amount !== undefined && amount !== "" ? Number(amount) : undefined,
    dueDate,
    description,
    billingType,
    manual: Boolean(manual),
    digitableLine,
    bankSlipUrl,
    notes
  });

  return res.status(201).json(invoice);
};

export const baixar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { invoiceId } = req.params;
  const { paidAt, paidAmount, notes } = req.body;

  const invoice = await baixarFatura(Number(invoiceId), {
    paidAt,
    paidAmount:
      paidAmount !== undefined && paidAmount !== ""
        ? Number(paidAmount)
        : undefined,
    notes
  });

  return res.json(invoice);
};

export const estornar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { invoiceId } = req.params;
  return res.json(await estornarFatura(Number(invoiceId)));
};

export const cancelar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { invoiceId } = req.params;
  return res.json(await cancelarFatura(Number(invoiceId)));
};

export const sincronizar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { invoiceId } = req.params;
  return res.json(await sincronizarFatura(Number(invoiceId)));
};

/**
 * Aviso do Asaas.
 *
 * Rota pública por natureza — quem chama é o gateway, sem token de usuário. A
 * proteção é o segredo combinado no painel deles, comparado com o do .env.
 * Sem `ASAAS_WEBHOOK_TOKEN` configurado a rota recusa tudo: aceitar qualquer
 * corpo que chegue deixaria qualquer um dar baixa nas próprias faturas.
 */
export const webhookAsaas = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  const recebido = req.headers["asaas-access-token"];

  if (!esperado) {
    logger.warn("Webhook do Asaas recebido sem ASAAS_WEBHOOK_TOKEN definido.");
    throw new AppError("ERR_WEBHOOK_NOT_CONFIGURED", 503);
  }

  if (recebido !== esperado) {
    throw new AppError("ERR_NO_PERMISSION", 401);
  }

  await ProcessarWebhookAsaas(req.body);

  // 200 sempre que o aviso foi processado ou descartado de propósito: o Asaas
  // repete a entrega enquanto não receber sucesso.
  return res.status(200).json({ ok: true });
};
