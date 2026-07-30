import AppError from "../../errors/AppError";
import Tag from "../../models/Tag";

const DeleteTagService = async (
  tagId: string | number,
  companyId: number
): Promise<void> => {
  const tag = await Tag.findOne({ where: { id: tagId, companyId } });

  if (!tag) {
    throw new AppError("ERR_NO_TAG_FOUND", 404);
  }

  // As linhas de TicketTags caem por cascade definido na migration.
  await tag.destroy();
};

export default DeleteTagService;
