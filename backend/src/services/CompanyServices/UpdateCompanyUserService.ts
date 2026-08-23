import AppError from "../../errors/AppError";
import Role from "../../models/Role";
import User from "../../models/User";
import { sanitizar } from "../../helpers/permissions/catalog";
import { gravarExcecoes } from "../../helpers/permissions/resolve";

interface Request {
  companyId: number;
  userId: number;
  /** null tira o cargo da pessoa — e, com ele, todo o acesso dela. */
  roleId?: number | null;
  exceptions?: { allow?: unknown; deny?: unknown };
}

/**
 * Cargo e exceções de um usuário, alterados pelo super-admin da plataforma.
 *
 * Existe separado de `SetUserAccessService` pelo mesmo motivo de
 * `ListCompanyUsersService`: aquele recebe o companyId do token e nunca de
 * fora, e é essa regra que impede uma empresa de mexer na outra. Abrir o
 * parâmetro lá para atender o super derrubaria a trava para todo mundo.
 *
 * As regras anti-escalação de guards.ts não se aplicam aqui, e é proposital:
 * elas existem para conter quem é membro de uma empresa. O super é o dono do
 * servidor — se ele quisesse privilégio, não precisaria da API para isso. O
 * que continua valendo é o recorte por empresa.
 *
 * Nome, e-mail, senha e filas continuam sendo editados dentro da empresa: são
 * dados que o admin dela conhece e mantém, e mexer neles de fora, sem o
 * contexto das filas e das conexões daquela empresa, é como se criam
 * inconsistências difíceis de rastrear depois.
 */
const UpdateCompanyUserService = async ({
  companyId,
  userId,
  roleId,
  exceptions
}: Request): Promise<User> => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  // A checagem é o que torna a rota segura: o companyId vem da URL, então sem
  // isto o super poderia mudar o acesso de qualquer usuário passando o id de
  // outra empresa.
  if (user.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  /**
   * O super não vira usuário de empresa por descuido.
   *
   * Rebaixá-lo a membro de uma empresa o trancaria fora do painel da
   * plataforma, e não há de onde desfazer isso pela interface.
   */
  if (user.profile === "super") {
    throw new AppError("ERR_CANNOT_CHANGE_SUPER", 400);
  }

  if (roleId !== undefined && roleId !== null) {
    const cargo = await Role.findOne({ where: { id: roleId, companyId } });

    // Um cargo de outra empresa daria a este usuário permissões definidas por
    // gente que não é dele.
    if (!cargo) {
      throw new AppError("Cargo não encontrado nesta empresa.", 404);
    }
  }

  await user.update({
    roleId: roleId !== undefined ? roleId : user.roleId,
    accessExceptions:
      exceptions !== undefined
        ? gravarExcecoes({
            allow: sanitizar(exceptions.allow),
            deny: sanitizar(exceptions.deny)
          })
        : user.accessExceptions
  });

  /**
   * A sessão não é derrubada.
   *
   * O servidor resolve as permissões consultando o banco a cada requisição
   * (`hasPermission`), então o novo acesso já vale imediatamente onde importa.
   * O que continua velho até o navegador recarregar é a lista que ele usa para
   * esconder botão — e para isso o controller emite um aviso pelo socket, que
   * é bem mais barato do que expulsar alguém do meio de um atendimento.
   */
  await user.reload({ include: [{ model: Role, as: "role" }] });
  return user;
};

export default UpdateCompanyUserService;
