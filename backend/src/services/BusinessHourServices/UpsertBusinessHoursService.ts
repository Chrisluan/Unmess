import BusinessHour from "../../models/BusinessHour";

interface DayInput {
  weekDay: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

// Substitui de uma vez todos os 7 dias configurados pela empresa - a tela
// de configuração sempre envia a semana inteira, então upsert em lote é
// mais simples e seguro do que tentar diffs individuais.
const UpsertBusinessHoursService = async (
  days: DayInput[],
  companyId: number
): Promise<BusinessHour[]> => {
  await Promise.all(
    days.map(day =>
      BusinessHour.findOrCreate({
        where: { weekDay: day.weekDay, companyId },
        defaults: { ...day, companyId }
      }).then(([record]) => record.update(day))
    )
  );

  return BusinessHour.findAll({
    where: { companyId },
    order: [["weekDay", "ASC"]]
  });
};

export default UpsertBusinessHoursService;
