import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Role from "../../models/Role";
import { comDependencias, sanitizar } from "../../helpers/permissions/catalog";
import { AcessoResolvido } from "../../helpers/permissions/resolve";
import { garantirQuePodeConceder } from "../../helpers/permissions/guards";

interface Request {
  name: string;
  description?: string;
  permissions?: unknown;
  companyId: number;
  /** Acesso de quem está criando, para a regra de "ninguém dá o que não tem". */
  ator: AcessoResolvido;
}

const CreateRoleService = async ({
  name,
  description,
  permissions,
  companyId,
  ator
}: Request): Promise<Role> => {
  const schema = Yup.object().shape({
    name: Yup.string().required("O cargo precisa de um nome.").min(2).max(60)
  });

  try {
    await schema.validate({ name });
  } catch (err) {
    throw new AppError(err.message);
  }

  const nome = name.trim();

  const jaExiste = await Role.findOne({ where: { companyId, name: nome } });

  if (jaExiste) {
    throw new AppError(`Já existe um cargo chamado "${nome}".`, 400);
  }

  // Sanitiza contra o catálogo e puxa as dependências junto: um cargo que
  // pode excluir conversa e não pode abri-la não é um cargo, é um bug.
  const permissoesFinais = comDependencias(sanitizar(permissions));

  garantirQuePodeConceder(ator, permissoesFinais);

  return Role.create({
    name: nome,
    slug: null,
    description: description?.trim() || null,
    permissions: JSON.stringify(permissoesFinais),
    isSystem: false,
    companyId
  } as any);
};

export default CreateRoleService;
