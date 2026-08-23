import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser, SerializedUser } from "../../helpers/SerializeUser";
import User from "../../models/User";
import Role from "../../models/Role";
import { AcessoResolvido } from "../../helpers/permissions/resolve";
import { garantirQuePodeConceder } from "../../helpers/permissions/guards";
import ShowRoleService from "../AccessServices/ShowRoleService";

interface Request {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  whatsappId?: number;
  companyId: number;
  /** Cargo inicial. Sem ele, a pessoa entra sem poder fazer nada. */
  roleId?: number | null;
  maxSimultaneousTickets?: number;
  /** Acesso de quem está cadastrando, e se essa pessoa pode atribuir cargo. */
  ator?: AcessoResolvido;
  atorPodeAtribuirCargo?: boolean;
}

/**
 * O padrão de quem cadastra, quando o chamador não informa.
 *
 * Não concede nada e não pode atribuir cargo. Um serviço de criação de
 * usuário que assuma o contrário quando o argumento falta é um serviço que
 * cria administradores por esquecimento — foi exatamente assim que
 * `profile = "admin"` virou o padrão do sistema antigo.
 */
const SEM_PODER: AcessoResolvido = {
  permissions: [],
  role: null,
  exceptions: { allow: [], deny: [] },
  isSuper: false
};

/**
 * Cadastra uma pessoa.
 *
 * O `profile` sumiu daqui. Ele era um parâmetro com valor padrão "admin": todo
 * usuário criado sem escolha explícita nascia com acesso total ao sistema. O
 * padrão de um sistema de permissões precisa ser o contrário — quem entra não
 * pode nada até alguém dizer o que pode.
 */
const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  whatsappId,
  companyId,
  roleId,
  maxSimultaneousTickets = 0,
  ator = SEM_PODER,
  atorPodeAtribuirCargo = false
}: Request): Promise<SerializedUser> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    email: Yup.string()
      .email()
      .required()
      .test(
        "Check-email",
        "An user with this email already exists.",
        async value => {
          if (!value) return false;
          const emailExists = await User.findOne({
            where: { email: value, companyId }
          });
          return !emailExists;
        }
      ),
    password: Yup.string().required().min(5)
  });

  try {
    await schema.validate({ email, password, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  // ── Cargo inicial ─────────────────────────────────────────────────────────
  let cargo: Role | null = null;

  if (roleId) {
    if (!atorPodeAtribuirCargo) {
      throw new AppError(
        "Você pode cadastrar pessoas, mas não definir o cargo delas. Cadastre " +
          "sem cargo e peça a quem gerencia acessos para atribuí-lo.",
        403
      );
    }

    // Filtra por empresa no WHERE: um id de outra empresa não é encontrado.
    cargo = await ShowRoleService(roleId, companyId);

    // Mesma regra de sempre: ninguém dá o que não tem — nem no cadastro.
    garantirQuePodeConceder(ator, cargo.permissionsList);
  }

  const user = await User.create(
    {
      email,
      password,
      name,
      profile: "member",
      companyId,
      roleId: cargo ? cargo.id : null,
      maxSimultaneousTickets: Number(maxSimultaneousTickets) || 0,
      whatsappId: whatsappId ? whatsappId : null
    },
    { include: ["queues", "whatsapp"] }
  );

  await user.$set("queues", queueIds);

  await user.reload({ include: [{ model: Role, as: "role" }, "queues", "whatsapp"] });

  return SerializeUser(user);
};

export default CreateUserService;
