import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Role from "../../models/Role";
import { comDependencias, sanitizar } from "../../helpers/permissions/catalog";
import { AcessoResolvido } from "../../helpers/permissions/resolve";
import { garantirQuePodeConceder } from "../../helpers/permissions/guards";
import ShowRoleService from "./ShowRoleService";

interface Request {
  roleId: string | number;
  name?: string;
  description?: string;
  permissions?: unknown;
  companyId: number;
  ator: AcessoResolvido;
}

const UpdateRoleService = async ({
  roleId,
  name,
  description,
  permissions,
  companyId,
  ator
}: Request): Promise<Role> => {
  const cargo = await ShowRoleService(roleId, companyId);

  if (cargo.isSystem) {
    throw new AppError(
      "O cargo de Administrador é mantido pelo sistema e não pode ser " +
        "editado. Para dar acesso parcial a alguém, crie um cargo novo.",
      403
    );
  }

  /**
   * Não se edita um cargo mais poderoso do que o próprio acesso.
   *
   * Do contrário, quem tem "criar e editar cargos" mas não tem o financeiro
   * poderia abrir o cargo "Financeiro", desmarcar tudo e salvar — e, na
   * prática, decidir sobre um módulo que não lhe cabe.
   */
  garantirQuePodeConceder(ator, cargo.permissionsList);

  if (name !== undefined) {
    const nome = name.trim();
    if (nome.length < 2) {
      throw new AppError("O nome do cargo precisa de ao menos 2 letras.");
    }

    const conflito = await Role.findOne({
      where: { companyId, name: nome, id: { [Op.ne]: cargo.id } }
    });

    if (conflito) {
      throw new AppError(`Já existe um cargo chamado "${nome}".`, 400);
    }

    cargo.name = nome;
  }

  if (description !== undefined) {
    cargo.description = description?.trim() || null;
  }

  if (permissions !== undefined) {
    const permissoesFinais = comDependencias(sanitizar(permissions));
    garantirQuePodeConceder(ator, permissoesFinais);
    cargo.permissionsList = permissoesFinais;
  }

  await cargo.save();

  return cargo;
};

export default UpdateRoleService;
