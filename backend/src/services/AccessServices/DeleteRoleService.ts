import AppError from "../../errors/AppError";
import User from "../../models/User";
import { AcessoResolvido } from "../../helpers/permissions/resolve";
import { garantirQuePodeConceder } from "../../helpers/permissions/guards";
import ShowRoleService from "./ShowRoleService";

interface Request {
  roleId: string | number;
  companyId: number;
  ator: AcessoResolvido;
}

const DeleteRoleService = async ({
  roleId,
  companyId,
  ator
}: Request): Promise<void> => {
  const cargo = await ShowRoleService(roleId, companyId);

  if (cargo.isSystem) {
    throw new AppError(
      "O cargo de Administrador é mantido pelo sistema e não pode ser excluído.",
      403
    );
  }

  garantirQuePodeConceder(ator, cargo.permissionsList);

  /**
   * Cargo com gente dentro não some por engano.
   *
   * A coluna é `ON DELETE SET NULL`, então a exclusão não apagaria ninguém —
   * deixaria todas essas pessoas sem acesso a nada, de uma vez, e quem clicou
   * só descobriria pelos chamados no dia seguinte.
   */
  const ocupantes = await User.count({ where: { roleId: cargo.id } });

  if (ocupantes > 0) {
    throw new AppError(
      `${ocupantes} pessoa(s) estão neste cargo. Mova-as para outro cargo ` +
        "antes de excluí-lo.",
      400
    );
  }

  await cargo.destroy();
};

export default DeleteRoleService;
