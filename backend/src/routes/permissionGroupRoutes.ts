import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import * as PermissionGroupController from "../controllers/PermissionGroupController";

const permissionGroupRoutes = express.Router();

// Catálogo de permissões disponíveis (flat list)
permissionGroupRoutes.get(
  "/permission-groups/available",
  isAuth,
  PermissionGroupController.available
);

// Catálogo estruturado por módulo (para UI de gerenciamento)
permissionGroupRoutes.get(
  "/permission-groups/modules",
  isAuth,
  PermissionGroupController.modules
);

// Permissões efetivas de um usuário (grupo + overrides resolvidos)
permissionGroupRoutes.get(
  "/permission-groups/user/:userId",
  isAuth,
  PermissionGroupController.userPermissions
);

// CRUD de grupos — apenas admin/super
permissionGroupRoutes.get(
  "/permission-groups",
  isAuth,
  PermissionGroupController.index
);

permissionGroupRoutes.get(
  "/permission-groups/:permissionGroupId",
  isAuth,
  PermissionGroupController.show
);

permissionGroupRoutes.post(
  "/permission-groups",
  isAuth,
  isAdmin,
  PermissionGroupController.store
);

permissionGroupRoutes.put(
  "/permission-groups/:permissionGroupId",
  isAuth,
  isAdmin,
  PermissionGroupController.update
);

permissionGroupRoutes.delete(
  "/permission-groups/:permissionGroupId",
  isAuth,
  isAdmin,
  PermissionGroupController.remove
);

export default permissionGroupRoutes;
