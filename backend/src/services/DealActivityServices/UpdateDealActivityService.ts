import AppError from "../../errors/AppError";
import DealActivity from "../../models/DealActivity";
import User from "../../models/User";

interface Request {
  activityId: string | number;
  body?: string;
  dueAt?: Date;
  // Marca/desmarca a tarefa como concluída
  done?: boolean;
  companyId: number;
}

const UpdateDealActivityService = async ({
  activityId,
  body,
  dueAt,
  done,
  companyId
}: Request): Promise<DealActivity> => {
  const activity = await DealActivity.findOne({
    where: { id: activityId, companyId }
  });

  if (!activity) {
    throw new AppError("ERR_NO_DEAL_ACTIVITY_FOUND", 404);
  }

  // Registros automáticos (mudança de etapa, ganho, perda) são histórico:
  // editá-los faria a timeline mentir sobre o que aconteceu.
  if (!["note", "task"].includes(activity.type)) {
    throw new AppError("ERR_DEAL_ACTIVITY_NOT_EDITABLE");
  }

  const dados: any = {};

  if (body !== undefined) dados.body = body;
  if (dueAt !== undefined) dados.dueAt = dueAt;
  if (done !== undefined) dados.doneAt = done ? new Date() : null;

  await activity.update(dados);

  await activity.reload({
    include: [{ model: User, as: "user", attributes: ["id", "name"] }]
  });

  return activity;
};

export default UpdateDealActivityService;
