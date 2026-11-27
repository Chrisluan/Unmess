import { Transaction } from "sequelize";

import ShowQueueService from "./ShowQueueService";

const DeleteQueueService = async (
  queueId: number | string,
  companyId: number,
  transaction?: Transaction
): Promise<void> => {
  const queue = await ShowQueueService(queueId, companyId);

  await queue.destroy({ transaction });
};

export default DeleteQueueService;
