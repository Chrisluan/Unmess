import { Op, WhereOptions } from "sequelize";
import Tag from "../../models/Tag";

interface Request {
  companyId: number;
  searchParam?: string;
}

const ListTagsService = async ({
  companyId,
  searchParam = ""
}: Request): Promise<Tag[]> => {
  let where: WhereOptions = { companyId };

  if (searchParam) {
    where = { companyId, name: { [Op.like]: `%${searchParam}%` } };
  }

  const tags = await Tag.findAll({
    where,
    order: [["name", "ASC"]]
  });

  return tags;
};

export default ListTagsService;
