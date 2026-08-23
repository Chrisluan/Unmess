import AppError from "../../errors/AppError";
import User from "../../models/User";
import Role from "../../models/Role";
import {
  AcessoResolvido,
  aplicarExcecoes,
  gravarExcecoes,
  resolverAcessoDoUsuario,
  ExcecoesDeAcesso
} from "../../helpers/permissions/resolve";
import { sanitizar } from "../../helpers/permissions/catalog";
import {
  garantirQueNaoEhSiMesmo,
  garantirQuePodeConceder,
  garantirQuePodeMexerEm,
  garantirQueSobraAdministrador
} from "../../helpers/permissions/guards";
import { SLUG_ADMINISTRADOR } from "../../helpers/permissions/roleTemplates";
import ShowRoleService from "./ShowRoleService";

interface Request {
  userId: string | number;
  /** Cargo novo. `null` deixa a pessoa sem cargo — e, portanto, sem acesso. */
  roleId?: number | null;
  exceptions?: { allow?: unknown; deny?: unknown };
  companyId: number;
  atorId: number;
  ator: AcessoResolvido;
}

/**
 * Define o cargo e as exceções individuais de uma pessoa.
 *
 * Esta é a única porta por onde acesso muda de mão, e ela é estreita de
 * propósito. Antes, isso viajava no mesmo `PUT /users/:id` que grava o nome e
 * o telefone, protegido apenas por "editar usuários": quem podia corrigir o
 * e-mail de um colega podia se promover a administrador no mesmo pedido.
 *
 * Agora exige `roles:assign` e passa pelas quatro regras de guards.ts antes de
 * gravar qualquer coisa.
 */
const SetUserAccessService = async ({
  userId,
  roleId,
  exceptions,
  companyId,
  atorId,
  ator
}: Request): Promise<AcessoResolvido> => {
  const alvo = await User.findOne({
    where: { id: userId, companyId },
    include: [{ model: Role, as: "role" }]
  });

  if (!alvo) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  garantirQueNaoEhSiMesmo(atorId, alvo.id);

  const acessoAtualDoAlvo = await resolverAcessoDoUsuario(alvo.id);
  garantirQuePodeMexerEm(ator, acessoAtualDoAlvo);

  // ── Cargo ──────────────────────────────────────────────────────────────────
  let cargoNovo: Role | null = alvo.role ?? null;

  if (roleId !== undefined) {
    // ShowRoleService filtra por companyId no WHERE: um id de outra empresa
    // simplesmente não é encontrado.
    cargoNovo = roleId === null ? null : await ShowRoleService(roleId, companyId);
  }

  // ── Exceções ──────────────────────────────────────────────────────────────
  const excecoes: ExcecoesDeAcesso =
    exceptions === undefined
      ? acessoAtualDoAlvo.exceptions
      : {
          allow: sanitizar(exceptions.allow),
          deny: sanitizar(exceptions.deny)
        };

  // ── O que a pessoa passará a poder, exatamente ────────────────────────────
  const permissoesResultantes = aplicarExcecoes(
    cargoNovo ? cargoNovo.permissionsList : [],
    excecoes
  );

  /**
   * A conferência é sobre o resultado, e não sobre o que foi digitado.
   *
   * Checar só a lista de exceções deixaria passar o caminho óbvio: escolher
   * para a pessoa um cargo mais poderoso do que o próprio e não mexer em
   * exceção nenhuma.
   */
  garantirQuePodeConceder(ator, permissoesResultantes);

  // ── A empresa não pode ficar sem administrador ────────────────────────────
  const eraAdministrador = alvo.role?.slug === SLUG_ADMINISTRADOR;
  const continuaAdministrador = cargoNovo?.slug === SLUG_ADMINISTRADOR;

  if (eraAdministrador && !continuaAdministrador) {
    const administradores = await User.count({
      where: { companyId, roleId: alvo.roleId }
    });
    garantirQueSobraAdministrador(administradores - 1);
  }

  await alvo.update({
    roleId: cargoNovo ? cargoNovo.id : null,
    accessExceptions: gravarExcecoes(excecoes)
  });

  return resolverAcessoDoUsuario(alvo.id);
};

export default SetUserAccessService;
