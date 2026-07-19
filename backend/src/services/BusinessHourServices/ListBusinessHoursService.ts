import BusinessHour from "../../models/BusinessHour";

const ListBusinessHoursService = async (
  companyId: number
): Promise<BusinessHour[]> => {
  const hours = await BusinessHour.findAll({
    where: { companyId },
    order: [["weekDay", "ASC"]]
  });

  return hours;
};

export default ListBusinessHoursService;
