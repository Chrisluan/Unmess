import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser, SerializedUser } from "../../helpers/SerializeUser";
import ShowUserService from "./ShowUserService";

/**
 * Edita os dados de uma pessoa: nome, e-mail, senha, filas, conexão e teto de
 * atendimentos.
 *
 * O que este serviço deliberadamente NÃO faz é mexer em cargo, em permissão
 * nem em profile. Ele fazia — aceitava `profile`, `permissionGroupId` e
 * `customPermissions` no mesmo corpo do nome e do e-mail, guardado apenas por
 * "editar usuários". Quem podia corrigir o telefone de um colega podia, no
 * mesmo pedido, se declarar administrador e ganhar o sistema inteiro. Não
 * havia sequer conferência de que a pessoa não estava editando a si mesma.
 *
 * Acesso agora passa só por SetUserAccessService, atrás de `roles:assign` e
 * das regras de guards.ts.
 */

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  queueIds?: number[];
  whatsappId?: number;
  maxSimultaneousTickets?: number;
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
}

const UpdateUserService = async ({
  userData,
  userId,
  companyId
}: Request): Promise<SerializedUser | undefined> => {
  const user = await ShowUserService(userId);

  if (user.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    password: Yup.string()
  });

  /**
   * Os campos são lidos um a um, e não espalhados do corpo da requisição.
   *
   * É o que impede que um campo novo do modelo — ou um campo antigo que
   * ninguém lembrava, como `profile` — passe a ser gravável pela API só por
   * existir na tabela.
   */
  const {
    email,
    password,
    name,
    queueIds = [],
    whatsappId,
    maxSimultaneousTickets
  } = userData;

  try {
    await schema.validate({ email, password, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  await user.update({
    email,
    password,
    name,
    whatsappId: whatsappId ? whatsappId : null,
    maxSimultaneousTickets:
      maxSimultaneousTickets !== undefined
        ? Number(maxSimultaneousTickets) || 0
        : user.maxSimultaneousTickets
  });

  await user.$set("queues", queueIds);

  await user.reload();

  return SerializeUser(user);
};

export default UpdateUserService;
