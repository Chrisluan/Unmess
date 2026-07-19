import TicketStatus from "../../models/TicketStatus";

const ListTicketStatusesService = async (
  companyId: number
): Promise<TicketStatus[]> => {
  const statuses = await TicketStatus.findAll({
    where: { companyId },
    order: [["name", "ASC"]]
  });

  return statuses;
};

export default ListTicketStatusesService;
