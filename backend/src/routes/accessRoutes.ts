import { Router } from "express";

import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import { semPermissao } from "../helpers/permissions/routeGuard";
import * as AccessController from "../controllers/AccessController";

const accessRoutes = Router();

/**
 * Cargos e acessos.
 *
 * Substitui `/permission-groups`, que tinha três problemas: metade das rotas
 * pedia só login (qualquer atendente listava os cargos da empresa), a consulta
 * de permissões de um usuário não filtrava por empresa, e o CRUD era guardado
 * por "é admin?" em vez de por uma permissão que pudesse ser delegada.
 */

// Todo mundo precisa saber o que pode fazer — é o que o frontend usa para
// decidir quais telas e botões mostrar. Devolve apenas o acesso de quem pede.
accessRoutes.get(
  "/access/me",
  isAuth,
  semPermissao("cada pessoa consulta o próprio acesso, e nada além dele"),
  AccessController.me
);

/**
 * O catálogo é a descrição do produto, não dado de ninguém: os mesmos quinze
 * módulos e as mesmas frases para todos os inquilinos, sem uma linha vinda do
 * banco. Por isso basta estar autenticado — e por isso o super-admin, que não
 * pertence a empresa nenhuma, também alcança: ele precisa dele para montar o
 * acesso de um usuário pelo painel da plataforma.
 *
 * O que o catálogo lista, ninguém consegue conceder só por conhecê-lo. Quem
 * decide isso são as rotas abaixo.
 */
accessRoutes.get(
  "/access/catalog",
  isAuth,
  semPermissao("descrição estática do produto, igual para todas as empresas"),
  AccessController.catalog
);

// ── Cargos ──────────────────────────────────────────────────────────────────
accessRoutes.get(
  "/access/roles",
  isAuth,
  requiresCompany,
  hasPermission("roles:view"),
  AccessController.indexRoles
);

accessRoutes.post(
  "/access/roles",
  isAuth,
  requiresCompany,
  hasPermission("roles:manage"),
  AccessController.storeRole
);

accessRoutes.get(
  "/access/roles/:roleId",
  isAuth,
  requiresCompany,
  hasPermission("roles:view"),
  AccessController.showRole
);

accessRoutes.put(
  "/access/roles/:roleId",
  isAuth,
  requiresCompany,
  hasPermission("roles:manage"),
  AccessController.updateRole
);

accessRoutes.delete(
  "/access/roles/:roleId",
  isAuth,
  requiresCompany,
  hasPermission("roles:manage"),
  AccessController.removeRole
);

// ── Acesso de cada pessoa ───────────────────────────────────────────────────
accessRoutes.get(
  "/access/users/:userId",
  isAuth,
  requiresCompany,
  hasPermission("roles:view"),
  AccessController.showUserAccess
);

// A única porta por onde cargo e exceções mudam de mão.
accessRoutes.put(
  "/access/users/:userId",
  isAuth,
  requiresCompany,
  hasPermission("roles:assign"),
  AccessController.updateUserAccess
);

export default accessRoutes;
