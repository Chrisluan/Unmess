import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";

interface Request {
  ticketId: string | number;
  tagIds: number[];
  companyId: number;
}

/**
 * Substitui as etiquetas do chat pelo conjunto informado.
 * Valida que toda etiqueta pertence à mesma empresa do chat — sem isso seria
 * possível colar uma etiqueta de outro tenant passando o id na mão.
 */
const SyncTicketTagsService = async ({
  ticketId,
  tagIds,
  companyId
}: Request): Promise<Ticket> => {
  const ticket = await ShowTicketService(ticketId, companyId);

  const validTags = await Tag.findAll({
    where: { id: { [Op.in]: tagIds }, companyId },
    attributes: ["id"]
  });

  if (validTags.length !== tagIds.length) {
    throw new AppError("ERR_INVALID_TAG", 400);
  }

  await ticket.$set(
    "tags",
    validTags.map(tag => tag.id)
  );

  await ticket.reload();

  return ShowTicketService(ticketId, companyId);
};

export default SyncTicketTagsService;
