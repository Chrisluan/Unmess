import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import DealAttachment from "../../models/DealAttachment";

interface Arquivo {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
}

interface Request {
  dealId: number | string;
  companyId: number;
  userId?: number;
  arquivos: Arquivo[];
  sourceMessageId?: string;
}

/**
 * Registra arquivos já gravados em disco como material do pedido.
 *
 * O multer põe o arquivo em /public com nome aleatório; aqui ele ganha dono,
 * nome legível e lugar no pedido.
 *
 * A primeira imagem de um pedido sem capa vira a capa automaticamente. Quem
 * sobe a arte quer vê-la no card, e obrigar um segundo clique para dizer o
 * óbvio só faria o card ficar vazio na maioria dos pedidos.
 */
const CreateDealAttachmentService = async ({
  dealId,
  companyId,
  userId,
  arquivos,
  sourceMessageId
}: Request): Promise<DealAttachment[]> => {
  const deal = await Deal.findOne({ where: { id: dealId, companyId } });

  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);
  if (!arquivos?.length) throw new AppError("ERR_NO_FILE_UPLOADED", 400);

  const jaTemCapa = await DealAttachment.count({
    where: { dealId: deal.id, companyId, isPreview: true }
  });

  let capaPendente = jaTemCapa === 0;

  const criados: DealAttachment[] = [];

  for (const arquivo of arquivos) {
    const ehImagem = String(arquivo.mimetype || "").startsWith("image/");
    const viraCapa = capaPendente && ehImagem;

    if (viraCapa) capaPendente = false;

    // eslint-disable-next-line no-await-in-loop
    const criado = await DealAttachment.create({
      dealId: deal.id,
      companyId,
      uploadedByUserId: userId || null,
      name: arquivo.originalname,
      fileName: arquivo.filename,
      mimetype: arquivo.mimetype,
      size: arquivo.size || 0,
      isPreview: viraCapa,
      sourceMessageId: sourceMessageId || null
    });

    criados.push(criado);
  }

  return criados;
};

export default CreateDealAttachmentService;
