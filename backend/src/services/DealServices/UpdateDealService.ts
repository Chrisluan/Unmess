import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import ShowDealService from "./ShowDealService";

interface DealData {
  title?: string;
  value?: number;
  expectedCloseAt?: Date;
  notes?: string;
  customerId?: number;
  contactId?: number;
  responsibleUserId?: number;
  lostReason?: string;
}

interface Request {
  dealData: DealData;
  dealId: string | number;
  companyId: number;
}

/**
 * Edição dos dados do negócio. A troca de etapa não passa por aqui — ela tem
 * regra própria (ordem, status, registro na timeline) em MoveDealService.
 */
const UpdateDealService = async ({
  dealData,
  dealId,
  companyId
}: Request): Promise<Deal> => {
  const deal = await Deal.findOne({ where: { id: dealId, companyId } });

  if (!deal) {
    throw new AppError("ERR_NO_DEAL_FOUND", 404);
  }

  await deal.update(dealData);

  return ShowDealService(deal.id, companyId);
};

export default UpdateDealService;
