import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { companyRoom } from "../libs/socketRooms";

import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";
import User from "../models/User";
import { MODULES, NIVEIS } from "../helpers/permissions/catalog";
import { MODELOS_DE_CARGO } from "../helpers/permissions/roleTemplates";
import { resolverAcessoDoUsuario } from "../helpers/permissions/resolve";

import ListRolesService from "../services/AccessServices/ListRolesService";
import ShowRoleService from "../services/AccessServices/ShowRoleService";
import CreateRoleService from "../services/AccessServices/CreateRoleService";
import UpdateRoleService from "../services/AccessServices/UpdateRoleService";
import DeleteRoleService from "../services/AccessServices/DeleteRoleService";
import SetUserAccessService from "../services/AccessServices/SetUserAccessService";

/**
 * Avisa a empresa que o acesso de alguém mudou.
 *
 * O evento não carrega permissão nenhuma — só diz "recarregue o seu acesso".
 * Quem recebe pergunta ao servidor o que pode fazer agora, e a resposta vem
 * pelo mesmo caminho de sempre, com as mesmas conferências.
 *
 * Sem isto, tirar uma permissão de alguém só apareceria na tela dessa pessoa
 * no próximo login: a API já negaria a ação na hora, mas o menu continuaria
 * mostrando a porta, e ela levaria um erro na cara sem entender por quê.
 */
const avisarMudancaDeAcesso = (companyId: number, payload: object): void => {
  getIO().to(companyRoom(companyId)).emit("access", payload);
};

/** Quem está pedindo, com as permissões já resolvidas. */
const acessoDoAtor = (req: Request) =>
  resolverAcessoDoUsuario(Number(req.user.id));

// ── Catálogo ────────────────────────────────────────────────────────────────

/**
 * O catálogo de permissões, do jeito que a tela precisa dele.
 *
 * Esta é a razão de o frontend não ter mais uma cópia própria. A que existia
 * ficou para trás em silêncio e não listava CRM, Financeiro, Produtos nem
 * Figurinhas — quatro módulos que, por isso, não tinham como ser concedidos a
 * ninguém pela interface. Uma lista que precisa ser atualizada em dois lugares
 * é uma lista que vai divergir.
 */
export const catalog = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  return res.status(200).json({
    modules: MODULES,
    levels: NIVEIS,
    templates: MODELOS_DE_CARGO
  });
};

/** O acesso de quem está pedindo. Todo mundo pode consultar o próprio. */
export const me = async (req: Request, res: Response): Promise<Response> => {
  const acesso = await resolverAcessoDoUsuario(Number(req.user.id));
  return res.status(200).json(acesso);
};

// ── Cargos ──────────────────────────────────────────────────────────────────

export const indexRoles = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const cargos = await ListRolesService(getCompanyId(req));
  return res.status(200).json(cargos);
};

export const showRole = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const cargo = await ShowRoleService(req.params.roleId, getCompanyId(req));
  return res.status(200).json({
    id: cargo.id,
    name: cargo.name,
    slug: cargo.slug ?? null,
    description: cargo.description ?? null,
    isSystem: cargo.isSystem,
    permissions: cargo.permissionsList
  });
};

export const storeRole = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = getCompanyId(req);
  const { name, description, permissions } = req.body;

  const cargo = await CreateRoleService({
    name,
    description,
    permissions,
    companyId,
    ator: await acessoDoAtor(req)
  });

  avisarMudancaDeAcesso(companyId, { action: "roleCreated", roleId: cargo.id });

  return res.status(200).json({
    id: cargo.id,
    name: cargo.name,
    slug: cargo.slug ?? null,
    description: cargo.description ?? null,
    isSystem: cargo.isSystem,
    permissions: cargo.permissionsList
  });
};

export const updateRole = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = getCompanyId(req);
  const { name, description, permissions } = req.body;

  const cargo = await UpdateRoleService({
    roleId: req.params.roleId,
    name,
    description,
    permissions,
    companyId,
    ator: await acessoDoAtor(req)
  });

  // Mexer num cargo muda o acesso de todo mundo que o ocupa ao mesmo tempo.
  avisarMudancaDeAcesso(companyId, { action: "roleUpdated", roleId: cargo.id });

  return res.status(200).json({
    id: cargo.id,
    name: cargo.name,
    slug: cargo.slug ?? null,
    description: cargo.description ?? null,
    isSystem: cargo.isSystem,
    permissions: cargo.permissionsList
  });
};

export const removeRole = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = getCompanyId(req);

  await DeleteRoleService({
    roleId: req.params.roleId,
    companyId,
    ator: await acessoDoAtor(req)
  });

  avisarMudancaDeAcesso(companyId, {
    action: "roleDeleted",
    roleId: Number(req.params.roleId)
  });

  return res.status(200).json({ message: "Cargo excluído." });
};

// ── Acesso de cada pessoa ───────────────────────────────────────────────────

export const showUserAccess = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = getCompanyId(req);
  const { userId } = req.params;

  /**
   * A empresa entra na consulta antes de resolver o acesso.
   *
   * A versão anterior recebia o id e ia direto ao resolvedor, sem olhar de
   * que empresa era o usuário: trocar o número na URL devolvia as permissões
   * de gente de outro cliente do SaaS.
   */
  const alvo = await User.findOne({
    where: { id: userId, companyId },
    attributes: ["id", "name", "email"]
  });

  if (!alvo) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  const acesso = await resolverAcessoDoUsuario(alvo.id);

  return res.status(200).json({
    user: { id: alvo.id, name: alvo.name, email: alvo.email },
    ...acesso
  });
};

export const updateUserAccess = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = getCompanyId(req);
  const { roleId, exceptions } = req.body;

  const acesso = await SetUserAccessService({
    userId: req.params.userId,
    roleId,
    exceptions,
    companyId,
    atorId: Number(req.user.id),
    ator: await acessoDoAtor(req)
  });

  avisarMudancaDeAcesso(companyId, {
    action: "userAccessChanged",
    userId: Number(req.params.userId)
  });

  return res.status(200).json(acesso);
};
