import { Sequelize, Op } from "sequelize";
import Role from "../../models/Role";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  searchParam?: string;
  pageNumber?: string | number;
  companyId: number;
}

interface Response {
  users: User[];
  count: number;
  hasMore: boolean;
}

const ListUsersService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId
}: Request): Promise<Response> => {
  const whereCondition = {
    companyId,
    [Op.or]: [
      {
        "$User.name$": Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("User.name")),
          "LIKE",
          `%${searchParam.toLowerCase()}%`
        )
      },
      { email: { [Op.like]: `%${searchParam.toLowerCase()}%` } }
    ]
  };
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: users } = await User.findAndCountAll({
    where: whereCondition,
    attributes: [
      "name",
      "id",
      "email",
      "profile",
      "roleId",
      // A tela de acessos marca quem foge do cargo. É o JSON das exceções, e
      // não segredo nenhum — só quem tem "users:view" chega aqui.
      "accessExceptions",
      "createdAt",
      "maxSimultaneousTickets",
      "online",
      "lastSeenAt"
    ],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name"] },
      {
        model: Role,
        as: "role",
        attributes: ["id", "name", "isSystem"],
        required: false
      }
    ]
  });

  const hasMore = count > offset + users.length;

  return {
    users,
    count,
    hasMore
  };
};

export default ListUsersService;
