import { Router } from "express";

import isAuth from "../middleware/isAuth";
import { semPermissao } from "../helpers/permissions/routeGuard";
import * as PreferencesController from "../controllers/PreferencesController";

const preferencesRoutes = Router();

/**
 * Preferências de tela.
 *
 * Caminho próprio, e não `/users/me/preferences`, para não passar perto de
 * `/users/:userId` — ali "me" seria só mais um id na rota, e a ordem de
 * registro no Express passaria a ser o que separa "guardo meus favoritos" de
 * "edito outro usuário".
 *
 * Sem `requiresCompany`: o super-admin, que não pertence a empresa nenhuma,
 * também tem menu e também favorita.
 */
preferencesRoutes.get(
  "/preferences",
  isAuth,
  semPermissao("cada pessoa lê as próprias preferências de tela, e nada além"),
  PreferencesController.show
);

preferencesRoutes.put(
  "/preferences",
  isAuth,
  semPermissao("cada pessoa grava as próprias preferências de tela"),
  PreferencesController.update
);

export default preferencesRoutes;
