import Role from "../../models/Role";
import User from "../../models/User";
import EnsureAdminRoleService from "./EnsureAdminRoleService";

export interface CargoListado {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  /** Quantas pessoas estão neste cargo — a tela avisa antes de excluir. */
  userCount: number;
}

/**
 * Lista os cargos da empresa, cada um com quantas pessoas o ocupam.
 *
 * A contagem não é enfeite: excluir um cargo com gente dentro deixaria essas
 * pessoas sem acesso nenhum, e quem clica precisa saber disso antes.
 */
const ListRolesService = async (companyId: number): Promise<CargoListado[]> => {
  await EnsureAdminRoleService(companyId);

  const cargos = await Role.findAll({
    where: { companyId },
    include: [{ model: User, as: "users", attributes: ["id"] }],
    order: [
      // O Administrador primeiro, o resto em ordem alfabética.
      ["isSystem", "DESC"],
      ["name", "ASC"]
    ]
  });

  return cargos.map(cargo => ({
    id: cargo.id,
    name: cargo.name,
    slug: cargo.slug ?? null,
    description: cargo.description ?? null,
    isSystem: cargo.isSystem,
    permissions: cargo.permissionsList,
    userCount: cargo.users?.length ?? 0
  }));
};

export default ListRolesService;
