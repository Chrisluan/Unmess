import { Request, Response, NextFunction, RequestHandler } from "express";
import AppError from "../errors/AppError";
import { usuarioPode } from "../helpers/permissions/resolve";
import { existePermissao, Permission } from "../helpers/permissions/catalog";
import { etiquetar } from "../helpers/permissions/routeGuard";

/**
 * Autorização de rota. Vai sempre depois de isAuth na cadeia.
 *
 *   router.delete("/tickets/:id", isAuth, requiresCompany,
 *                 hasPermission("tickets:delete"), handler)
 *
 * Duas garantias que valem a pena registrar:
 *
 * 1. A permissão citada é conferida contra o catálogo na hora em que o arquivo
 *    de rotas é carregado, e não na primeira requisição. Um erro de digitação
 *    em "tickets:delete" antes virava uma permissão que ninguém tem — a rota
 *    ficava trancada para todo mundo, inclusive para quem devia poder usá-la,
 *    e só se descobria pelo relato de quem tentou. Agora o processo nem sobe.
 *
 * 2. A consulta vai ao banco a cada requisição. Custa uma leitura indexada e
 *    paga por si: tirar o acesso de alguém passa a valer na hora, sem esperar
 *    o token expirar.
 */
const hasPermission = (permission: Permission): RequestHandler => {
  if (!existePermissao(permission)) {
    throw new Error(
      `Rota declara a permissão "${permission}", que não existe no catálogo ` +
        "(backend/src/helpers/permissions/catalog.ts)."
    );
  }

  const middleware = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    const permitido = await usuarioPode(Number(req.user.id), permission);

    if (!permitido) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    next();
  };

  return etiquetar(middleware, { tipo: "permissao", permissao: permission });
};

export default hasPermission;
