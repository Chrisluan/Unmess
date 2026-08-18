import { Request, Response } from "express";

import ListStickersService from "../services/StickerServices/ListStickersService";
import CreateStickerService from "../services/StickerServices/CreateStickerService";
import DeleteStickerService from "../services/StickerServices/DeleteStickerService";
import SaveStickerFromMessageService from "../services/StickerServices/SaveStickerFromMessageService";
import SendWhatsAppSticker from "../services/WbotServices/SendWhatsAppSticker";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";

import Sticker from "../models/Sticker";
import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";

type IndexQuery = {
  searchParam?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam } = req.query as IndexQuery;

  const stickers = await ListStickersService({
    companyId: getCompanyId(req),
    searchParam
  });

  return res.json({ stickers });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name } = req.body;
  const arquivoEnviado = req.file as Express.Multer.File;

  const sticker = await CreateStickerService({
    name,
    companyId: getCompanyId(req),
    arquivoEnviado
  });

  return res.status(200).json(sticker);
};

/**
 * Guarda na biblioteca uma figurinha que chegou numa conversa.
 *
 * Recebe o id da mensagem, e não um arquivo: a figurinha já está no servidor
 * desde que o cliente a enviou, e reenviá-la do navegador seria baixar e subir
 * o mesmo arquivo à toa.
 */
export const saveFromMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { name } = req.body;

  const sticker = await SaveStickerFromMessageService({
    messageId,
    name,
    companyId: getCompanyId(req)
  });

  return res.status(200).json(sticker);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { stickerId } = req.params;

  await DeleteStickerService({ id: stickerId, companyId: getCompanyId(req) });

  return res.status(200).json({ message: "Sticker deleted" });
};

/**
 * Manda uma figurinha da biblioteca para uma conversa.
 *
 * Fica no controller de figurinhas, e não no de mensagens, porque o que chega
 * do navegador é o id de uma figurinha -- não um arquivo. O de mensagens
 * espera upload em multipart e descartaria o arquivo depois do envio, que é
 * exatamente o que não se quer com um item de biblioteca.
 */
export const send = async (req: Request, res: Response): Promise<Response> => {
  const { stickerId, ticketId } = req.params;
  const companyId = getCompanyId(req);

  const sticker = await Sticker.findOne({ where: { id: stickerId, companyId } });
  if (!sticker) throw new AppError("ERR_NO_STICKER_FOUND", 404);

  const ticket = await ShowTicketService(ticketId, companyId);

  SetTicketMessagesAsRead(ticket);

  await SendWhatsAppSticker({ sticker, ticket });

  return res.send();
};
