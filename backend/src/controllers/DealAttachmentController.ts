import { Request, Response } from "express";

import ListDealAttachmentsService from "../services/DealAttachmentServices/ListDealAttachmentsService";
import CreateDealAttachmentService from "../services/DealAttachmentServices/CreateDealAttachmentService";
import ImportarMidiaDaConversaService from "../services/DealAttachmentServices/ImportarMidiaDaConversaService";
import ListarMidiasDaConversaService from "../services/DealAttachmentServices/ListarMidiasDaConversaService";
import DefinirCapaService from "../services/DealAttachmentServices/DefinirCapaService";
import DeleteDealAttachmentService from "../services/DealAttachmentServices/DeleteDealAttachmentService";
import ShowDealService from "../services/DealServices/ShowDealService";
import getCompanyId from "../helpers/GetCompanyId";
import { getIO } from "../libs/socket";
import { companyRoom } from "../libs/socketRooms";

/**
 * Avisa quem está com o quadro aberto que o card mudou.
 *
 * A capa do pedido aparece no Kanban; trocá-la sem emitir deixaria a arte
 * antiga na tela de todo mundo até alguém recarregar a página.
 */
const avisarQuadro = async (dealId: string, companyId: number) => {
  const deal = await ShowDealService(dealId, companyId);

  getIO()
    .to(companyRoom(companyId))
    .emit("deal", { action: "update", deal });
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { dealId } = req.params;

  const attachments = await ListDealAttachmentsService({
    dealId,
    companyId: getCompanyId(req)
  });

  return res.json({ attachments });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { dealId } = req.params;
  const companyId = getCompanyId(req);
  const arquivos = (req.files as Express.Multer.File[]) || [];

  const attachments = await CreateDealAttachmentService({
    dealId,
    companyId,
    userId: Number(req.user.id),
    arquivos
  });

  await avisarQuadro(dealId, companyId);

  return res.status(201).json({ attachments });
};

/** Mídias das conversas ligadas ao pedido, para escolher sem sair da tela. */
export const midiasDaConversa = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { dealId } = req.params;

  const midias = await ListarMidiasDaConversaService({
    dealId,
    companyId: getCompanyId(req)
  });

  return res.json({ midias });
};

export const importar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { dealId } = req.params;
  const { messageId } = req.body;
  const companyId = getCompanyId(req);

  const attachment = await ImportarMidiaDaConversaService({
    dealId,
    messageId,
    companyId,
    userId: Number(req.user.id)
  });

  await avisarQuadro(dealId, companyId);

  return res.status(201).json({ attachment });
};

export const definirCapa = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { dealId, attachmentId } = req.params;
  const companyId = getCompanyId(req);

  const attachment = await DefinirCapaService({ attachmentId, companyId });

  await avisarQuadro(dealId, companyId);

  return res.json({ attachment });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { dealId, attachmentId } = req.params;
  const companyId = getCompanyId(req);

  await DeleteDealAttachmentService({ attachmentId, companyId });

  await avisarQuadro(dealId, companyId);

  return res.status(200).json({ message: "Attachment deleted" });
};
