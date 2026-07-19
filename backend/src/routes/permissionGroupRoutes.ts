import express from "express";
import isAuth from "../middleware/isAuth";

import * as PermissionGroupController from "../controllers/PermissionGroupController";

const permissionGroupRoutes = express.Router();

permissionGroupRoutes.get(
  "/permission-groups/available",
  isAuth,
  PermissionGroupController.available
);

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
  PermissionGroupController.store
);

permissionGroupRoutes.put(
  "/permission-groups/:permissionGroupId",
  isAuth,
  PermissionGroupController.update
);

permissionGroupRoutes.delete(
  "/permission-groups/:permissionGroupId",
  isAuth,
  PermissionGroupController.remove
);

export default permissionGroupRoutes;
