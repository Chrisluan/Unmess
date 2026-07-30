import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Tag from "../../models/Tag";

interface Request {
  name: string;
  color?: string;
  companyId: number;
}

const CreateTagService = async ({
  name,
  color = "#2ecc71",
  companyId
}: Request): Promise<Tag> => {
  const schema = Yup.object().shape({
    name: Yup.string()
      .required()
      .min(1)
      .max(40)
      .test(
        "Check-unique-name",
        "ERR_TAG_DUPLICATED_NAME",
        async value => {
          if (!value) return false;
          const exists = await Tag.findOne({
            where: { name: value, companyId }
          });
          return !exists;
        }
      )
  });

  try {
    await schema.validate({ name });
  } catch (err) {
    throw new AppError(err.message);
  }

  const tag = await Tag.create({ name, color, companyId });

  return tag;
};

export default CreateTagService;
