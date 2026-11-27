import { Transaction } from "sequelize";

import AppError from "../../errors/AppError";
import BusinessHour from "../../models/BusinessHour";

interface DayInput {
  weekDay: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * Formato antes de tudo: um "8h" ou "25:00" era gravado e a conta de
 * "está aberto?" passava a dar sempre o mesmo resultado, sem erro nenhum.
 * Início depois do fim é decidido pelo motor de consistência, que explica
 * o efeito ("nesse dia a empresa ficaria sempre fechada").
 */
const validar = (days: DayInput[]): DayInput[] => {
  if (!Array.isArray(days)) throw new AppError("ERR_BUSINESS_HOURS_INVALID", 400);

  return days.map(day => {
    const weekDay = Number(day.weekDay);
    if (!Number.isInteger(weekDay) || weekDay < 0 || weekDay > 6) {
      throw new AppError("ERR_BUSINESS_HOURS_INVALID", 400);
    }
    if (!HORA.test(String(day.startTime)) || !HORA.test(String(day.endTime))) {
      throw new AppError("ERR_BUSINESS_HOURS_INVALID_TIME", 400);
    }
    return {
      weekDay,
      enabled: Boolean(day.enabled),
      startTime: String(day.startTime),
      endTime: String(day.endTime)
    };
  });
};

// Substitui de uma vez todos os 7 dias configurados pela empresa - a tela
// de configuração sempre envia a semana inteira, então upsert em lote é
// mais simples e seguro do que tentar diffs individuais.
const UpsertBusinessHoursService = async (
  days: DayInput[],
  companyId: number,
  transaction?: Transaction
): Promise<BusinessHour[]> => {
  const dias = validar(days);

  // Em sequência, não em paralelo: dentro de uma transação a mesma conexão
  // atende tudo, e disparar sete findOrCreate juntos nela só embaralha.
  // eslint-disable-next-line no-restricted-syntax
  for (const day of dias) {
    // eslint-disable-next-line no-await-in-loop
    const [record] = await BusinessHour.findOrCreate({
      where: { weekDay: day.weekDay, companyId },
      defaults: { ...day, companyId },
      transaction
    });
    // eslint-disable-next-line no-await-in-loop
    await record.update(day, { transaction });
  }

  return BusinessHour.findAll({
    where: { companyId },
    order: [["weekDay", "ASC"]],
    transaction
  });
};

export default UpsertBusinessHoursService;
