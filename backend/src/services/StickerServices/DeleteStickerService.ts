import path from "path";
import { unlink } from "fs/promises";

import Sticker from "../../models/Sticker";
import AppError from "../../errors/AppError";
import uploadConfig from "../../config/upload";

interface Request {
  id: string | number;
  companyId: number;
}

const DeleteStickerService = async ({ id, companyId }: Request): Promise<void> => {
  // O companyId entra na busca, e não numa conferência depois: assim uma
  // empresa não consegue apagar a figurinha de outra nem descobrir que ela
  // existe -- o retorno é o mesmo "não encontrada" dos dois casos.
  const sticker = await Sticker.findOne({ where: { id, companyId } });

  if (!sticker) throw new AppError("ERR_NO_STICKER_FOUND", 404);

  // getDataValue devolve o nome cru; o getter do modelo já vem com o prefixo
  // /public, que não é caminho de disco.
  const arquivo = sticker.getDataValue("fileName") as string | null;

  await sticker.destroy();

  // O arquivo sai depois do registro: se a ordem fosse inversa e o destroy
  // falhasse, a gaveta ficaria com uma figurinha que não abre.
  if (arquivo) {
    await unlink(path.resolve(uploadConfig.directory, arquivo)).catch(() => undefined);
  }
};

export default DeleteStickerService;
