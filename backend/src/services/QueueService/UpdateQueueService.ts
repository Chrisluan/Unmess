import { Op, Transaction } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import ShowQueueService from "./ShowQueueService";

interface QueueData {
  name?: string;
  color?: string;
  greetingMessage?: string;
  isDefault?: boolean;
}

const UpdateQueueService = async (
  queueId: number | string,
  queueData: QueueData,
  companyId: number,
  transaction?: Transaction
): Promise<Queue> => {
  const { color, name } = queueData;

  const queueSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_QUEUE_INVALID_NAME")
      .test(
        "Check-unique-name",
        "ERR_QUEUE_NAME_ALREADY_EXISTS",
        async value => {
          if (value) {
            const queueWithSameName = await Queue.findOne({
              where: { name: value, companyId, id: { [Op.not]: queueId } }
            });

            return !queueWithSameName;
          }
          return true;
        }
      ),
    color: Yup.string()
      .required("ERR_QUEUE_INVALID_COLOR")
      .test("Check-color", "ERR_QUEUE_INVALID_COLOR", async value => {
        if (value) {
          const colorTestRegex = /^#[0-9a-f]{3,6}$/i;
          return colorTestRegex.test(value);
        }
        return true;
      })
  });

  try {
    await queueSchema.validate({ color, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  const queue = await ShowQueueService(queueId, companyId);

  // Só pode existir um setor padrão por empresa. Ao marcar este como
  // padrão, desmarca qualquer outro que já fosse.
  if (queueData.isDefault === true) {
    await Queue.update(
      { isDefault: false },
      { where: { companyId, id: { [Op.not]: queueId } }, transaction }
    );
  }

  // Só os campos do setor: o corpo da requisição chegava inteiro e dava para
  // trocar a empresa dona do setor.
  const { greetingMessage, isDefault } = queueData;
  await queue.update(
    { name, color, greetingMessage, isDefault },
    { transaction }
  );

  return queue;
};

export default UpdateQueueService;
