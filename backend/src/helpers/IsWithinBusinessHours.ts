import BusinessHour from "../models/BusinessHour";
import Holiday from "../models/Holiday";

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * Verifica se hoje é feriado cadastrado para a empresa.
 * Datas recorrentes comparam apenas dia e mês.
 */
const isHoliday = async (companyId: number, now: Date): Promise<boolean> => {
  const isoDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
  const monthDay = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const exact = await Holiday.findOne({
    where: { companyId, recurring: false, date: isoDate }
  });

  if (exact) return true;

  const recurring = await Holiday.findAll({
    where: { companyId, recurring: true },
    attributes: ["date"]
  });

  return recurring.some(h => String(h.date).slice(5) === monthDay);
};

// Se a empresa não configurou nenhum horário, consideramos que está sempre
// "aberta" (comportamento atual do sistema, sem regressão).
const IsWithinBusinessHours = async (companyId: number): Promise<boolean> => {
  const hours = await BusinessHour.findAll({ where: { companyId } });

  if (hours.length === 0) {
    return true;
  }

  const now = new Date();

  // Feriado tem precedência sobre a grade semanal: mesmo que a terça esteja
  // marcada como dia útil, num feriado a empresa está fechada.
  if (await isHoliday(companyId, now)) {
    return false;
  }

  const weekDay = now.getDay();

  const today = hours.find(h => h.weekDay === weekDay);

  if (!today || !today.enabled) {
    return false;
  }

  const [startHour, startMinute] = today.startTime.split(":").map(Number);
  const [endHour, endMinute] = today.endTime.split(":").map(Number);

  const start = new Date(now);
  start.setHours(startHour, startMinute, 0, 0);

  const end = new Date(now);
  end.setHours(endHour, endMinute, 0, 0);

  return now >= start && now <= end;
};

export { isHoliday };
export default IsWithinBusinessHours;
