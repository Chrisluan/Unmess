import AppError from "../../errors/AppError";
import DealActivity from "../../models/DealActivity";

const DeleteDealActivityService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const activity = await DealActivity.findOne({
    where: { id, companyId }
  });

  if (!activity) {
    throw new AppError("ERR_NO_DEAL_ACTIVITY_FOUND", 404);
  }

  // Mesma razão do update: o rastro automático do negócio não se apaga.
  if (!["note", "task"].includes(activity.type)) {
    throw new AppError("ERR_DEAL_ACTIVITY_NOT_EDITABLE");
  }

  await activity.destroy();
};

export default DeleteDealActivityService;
