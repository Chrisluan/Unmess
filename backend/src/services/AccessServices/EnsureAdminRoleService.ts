import Role from "../../models/Role";
import { ALL_PERMISSIONS } from "../../helpers/permissions/catalog";
import { SLUG_ADMINISTRADOR } from "../../helpers/permissions/roleTemplates";

/**
 * Garante que a empresa tem o cargo de Administrador, e devolve-o.
 *
 * Chamado ao criar uma empresa e sempre que alguém vai atribuir cargos: uma
 * empresa sem Administrador é uma empresa onde ninguém consegue liberar nada
 * para ninguém, e o conserto seria à mão no banco.
 *
 * A lista gravada na coluna é só o retrato do dia — quem lê as permissões do
 * Administrador recebe o catálogo em tempo de execução (ver Role.permissionsList).
 */
const EnsureAdminRoleService = async (companyId: number): Promise<Role> => {
  const existente = await Role.findOne({
    where: { companyId, slug: SLUG_ADMINISTRADOR }
  });

  if (existente) return existente;

  return Role.create({
    name: "Administrador",
    slug: SLUG_ADMINISTRADOR,
    description:
      "Acesso total ao sistema. Mantido pelo sistema: não pode ser editado nem excluído, e toda permissão criada daqui para a frente já nasce incluída.",
    permissions: JSON.stringify([...ALL_PERMISSIONS]),
    isSystem: true,
    companyId
  } as any);
};

export default EnsureAdminRoleService;
