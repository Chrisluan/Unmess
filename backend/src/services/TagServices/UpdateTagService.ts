import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Tag from "../../models/Tag";

interface Request {
  tagId: string | number;
  companyId: number;
  tagData: { name?: string; color?: string };
}

const UpdateTagService = async ({
  tagId,
  companyId,
  tagData
}: Request): Promise<Tag> => {
  const tag = await Tag.findOne({ where: { id: tagId, companyId } });

  if (!tag) {
    throw new AppError("ERR_NO_TAG_FOUND", 404);
  }

  if (tagData.name && tagData.name !== tag.name) {
    const duplicated = await Tag.findOne({
      where: { name: tagData.name, companyId, id: { [Op.ne]: tag.id } }
    });

    if (duplicated) {
      throw new AppError("ERR_TAG_DUPLICATED_NAME");
    }
  }

  await tag.update(tagData);

  return tag;
};

export default UpdateTagService;
