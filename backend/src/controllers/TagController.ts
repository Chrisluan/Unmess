import { Request, Response } from "express";

import { getIO } from "../libs/socket";
import {
  companyRoom,
  notificationRoom,
  statusRoom,
  ticketRoom
} from "../libs/socketRooms";
import getCompanyId from "../helpers/GetCompanyId";

import ListTagsService from "../services/TagServices/ListTagsService";
import CreateTagService from "../services/TagServices/CreateTagService";
import UpdateTagService from "../services/TagServices/UpdateTagService";
import DeleteTagService from "../services/TagServices/DeleteTagService";
import SyncTicketTagsService from "../services/TagServices/SyncTicketTagsService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam } = req.query as { searchParam?: string };

  const tags = await ListTagsService({
    companyId: getCompanyId(req),
    searchParam
  });

  return res.status(200).json(tags);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color } = req.body;

  const tag = await CreateTagService({
    name,
    color,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("tag", { action: "create", tag });

  return res.status(200).json(tag);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tagId } = req.params;

  const tag = await UpdateTagService({
    tagId,
    companyId: getCompanyId(req),
    tagData: req.body
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("tag", { action: "update", tag });

  return res.status(200).json(tag);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tagId } = req.params;

  await DeleteTagService(tagId, getCompanyId(req));

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("tag", {
    action: "delete",
    tagId: +tagId
  });

  return res.status(200).json({ message: "Tag deleted" });
};

/**
 * Aplica o conjunto de etiquetas de um chat (substitui o anterior).
 */
export const syncTicketTags = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { tagIds } = req.body as { tagIds: number[] };

  const ticket = await SyncTicketTagsService({
    ticketId,
    tagIds: Array.isArray(tagIds) ? tagIds : [],
    companyId: getCompanyId(req)
  });

  const io = getIO();
  const empresa = getCompanyId(req);

  io.to(companyRoom(empresa))
    .to(statusRoom(empresa, ticket.status))
    .to(ticketRoom(empresa, ticketId))
    .emit("ticket", { action: "update", ticket });

  return res.status(200).json(ticket);
};
