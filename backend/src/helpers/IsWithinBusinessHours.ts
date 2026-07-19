import BusinessHour from "../models/BusinessHour";

// Se a empresa não configurou nenhum horário, consideramos que está sempre
// "aberta" (comportamento atual do sistema, sem regressão).
const IsWithinBusinessHours = async (companyId: number): Promise<boolean> => {
  const hours = await BusinessHour.findAll({ where: { companyId } });

  if (hours.length === 0) {
    return true;
  }

  const now = new Date();
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

export default IsWithinBusinessHours;
