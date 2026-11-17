import AppError from "../../errors/AppError";
import Role from "../../models/Role";

/**
 * Busca um cargo dentro da empresa de quem pede.
 *
 * O `companyId` entra no WHERE, e não numa conferência depois: é o que impede
 * que trocar o número na URL alcance o cargo de outra empresa. O erro é 404 e
 * não 403 de propósito — quem procura fora da própria empresa não deve nem
 * descobrir se aquele id existe.
 */
const ShowRoleService = async (
  roleId: string | number,
  companyId: number
): Promise<Role> => {
  const cargo = await Role.findOne({ where: { id: roleId, companyId } });

  if (!cargo) {
    throw new AppError("Cargo não encontrado.", 404);
  }

  return cargo;
};

export default ShowRoleService;
