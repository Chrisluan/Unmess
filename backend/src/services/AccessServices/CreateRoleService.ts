import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Role from "../../models/Role";
import { comDependencias, sanitizar } from "../../helpers/permissions/catalog";
import { AcessoResolvido } from "../../helpers/permissions/resolve";
import {
  garantirQuePodeConceder,
  garantirQuePodeConcederEscopos
} from "../../helpers/permissions/guards";
import {
  gravarEscoposDoCargo,
  lerEscoposDoCargo,
  resolverEscopos
} from "../../helpers/permissions/escopos";

interface Request {
  name: string;
  description?: string;
  permissions?: unknown;
  /** `{"board":{"todos":true},"account":{"ids":[1,2]}}` */
  scopes?: unknown;
  companyId: number;
  /** Acesso de quem está criando, para a regra de "ninguém dá o que não tem". */
  ator: AcessoResolvido;
}

const CreateRoleService = async ({
  name,
  description,
  permissions,
  scopes,
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

  /**
   * Cargo novo nasce sem alcance nenhum quando ninguém disser o contrário.
   *
   * É a regra escolhida para o sistema: escopo vazio não alcança nada. Ela só
   * é suportável porque a tela mostra o alcance ao lado das permissões — quem
   * cria um cargo e esquece o escopo descobre na hora, e não pelo relato de
   * alguém que abriu o CRM vazio na semana seguinte.
   */
  const escoposFinais = lerEscoposDoCargo(JSON.stringify(scopes ?? {}));

  garantirQuePodeConcederEscopos(
    ator,
    resolverEscopos({
      isSuper: false,
      escoposDoCargo: escoposFinais,
      excecoes: {}
    })
  );

  return Role.create({
    name: nome,
    slug: null,
    description: description?.trim() || null,
    permissions: JSON.stringify(permissoesFinais),
    scopes: gravarEscoposDoCargo(escoposFinais),
    isSystem: false,
    companyId
  } as any);
};

export default CreateRoleService;
