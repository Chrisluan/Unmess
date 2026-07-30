import AppError from "../../errors/AppError";
import Holiday from "../../models/Holiday";

export const listHolidays = async (companyId: number): Promise<Holiday[]> =>
  Holiday.findAll({
    where: { companyId },
    order: [["date", "ASC"]]
  });

export const createHoliday = async (
  companyId: number,
  data: { name: string; date: string; recurring?: boolean }
): Promise<Holiday> => {
  if (!data?.name?.trim() || !data?.date) {
    throw new AppError("ERR_INVALID_HOLIDAY", 400);
  }

  // Evita duplicata da mesma data — o admin costuma cadastrar duas vezes
  // sem perceber ao revisar a lista do ano.
  const existing = await Holiday.findOne({
    where: { companyId, date: data.date }
  });

  if (existing) {
    throw new AppError("ERR_DUPLICATED_HOLIDAY", 400);
  }

  return Holiday.create({
    companyId,
    name: data.name.trim(),
    date: data.date,
    recurring: !!data.recurring
  });
};

export const deleteHoliday = async (
  companyId: number,
  holidayId: string | number
): Promise<void> => {
  const holiday = await Holiday.findOne({
    where: { id: holidayId, companyId }
  });

  if (!holiday) {
    throw new AppError("ERR_NO_HOLIDAY_FOUND", 404);
  }

  await holiday.destroy();
};
