import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Role from "../../models/Role";
import Queue from "../../models/Queue";
import User from "../../models/User";

interface Request {
  companyId: number;
}

/**
 * Usuários de uma empresa, vistos pelo super.
 *
 * `ListUsersService` também lista usuários, mas ele é do inquilino: recebe o
 * companyId do token e nunca de fora, o que é a trava que impede uma empresa
 * de enxergar a outra. Reaproveitá-lo aqui significaria abrir esse parâmetro
 * — e a partir daí a garantia deixa de existir para todo mundo.
 *
 * Este serviço é o oposto: só o super chega nele, e o companyId vem
 * justamente de fora, porque o super não pertence a empresa nenhuma.
 */
const ListCompanyUsersService = async ({
  companyId
}: Request): Promise<User[]> => {
  const company = await Company.findByPk(companyId, { attributes: ["id"] });

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  return User.findAll({
    where: { companyId },
    attributes: [
      "id",
      "name",
      "email",
      "profile",
      "roleId",
      // O painel do super edita cargo e exceções na mesma tela; sem isto
      // seria preciso uma segunda chamada por linha da lista.
      "accessExceptions",
      "online",
      "lastSeenAt",
      "createdAt"
    ],
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name"] },
      {
        model: Role,
        as: "role",
        attributes: ["id", "name", "slug", "isSystem"],
        required: false
      }
    ],
    // Administradores primeiro: é quem o super procura quando precisa falar
    // com a empresa. A ordenação é pelo cargo, e não mais pelo profile — que
    // deixou de dizer qualquer coisa sobre o que a pessoa pode fazer.
    order: [
      [{ model: Role, as: "role" }, "isSystem", "DESC"],
      ["name", "ASC"]
    ]
  });
};

export default ListCompanyUsersService;
