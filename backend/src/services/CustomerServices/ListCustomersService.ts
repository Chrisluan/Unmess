import { Sequelize, Op } from "sequelize";
import Customer from "../../models/Customer";
import Contact from "../../models/Contact";
import User from "../../models/User";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  companyId: number;
}

interface Response {
  customers: Customer[];
  count: number;
  hasMore: boolean;
}

const ListCustomersService = async ({
  searchParam = "",
  pageNumber = "1",
  status,
  companyId
}: Request): Promise<Response> => {
  const whereCondition: any = {
    companyId,
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("Customer.name")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
        )
      },
      {
        tradeName: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("Customer.tradeName")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
        )
      },
      { document: { [Op.like]: `%${searchParam.trim()}%` } },
      { phone: { [Op.like]: `%${searchParam.trim()}%` } },
      { whatsapp: { [Op.like]: `%${searchParam.trim()}%` } }
    ]
  };

  if (status) {
    whereCondition.status = status;
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: customers } = await Customer.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["name", "ASC"]],
    include: [
      { model: Contact, attributes: ["id", "name", "number", "profilePicUrl"] },
      { model: User, as: "responsibleUser", attributes: ["id", "name"] }
    ]
  });

  const hasMore = count > offset + customers.length;

  return {
    customers,
    count,
    hasMore
  };
};

export default ListCustomersService;
