import path from "path";
import crypto from "crypto";
import { unlink } from "fs/promises";
import * as Yup from "yup";

import Sticker from "../../models/Sticker";
import AppError from "../../errors/AppError";
import uploadConfig from "../../config/upload";
import { converterParaFigurinha } from "../../helpers/ConverterFigurinha";

interface Request {
  name: string;
  companyId: number;
  arquivoEnviado: Express.Multer.File;
}

/**
 * Guarda uma figurinha na biblioteca da empresa.
 *
 * O arquivo que chega é o que o atendente tinha à mão -- PNG, JPG, GIF, um
 * vídeo curto -- e nunca serve como figurinha do jeito que veio. A conversão
 * para WebP 512x512 acontece aqui, e o original é descartado: manter os dois
 * encheria o disco com o dobro do necessário para nada.
 */
const CreateStickerService = async ({
  name,
  companyId,
  arquivoEnviado
}: Request): Promise<Sticker> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(1).max(60)
  });

  try {
    await schema.validate({ name });
  } catch (err) {
    throw new AppError(err.message);
  }

  if (!arquivoEnviado) throw new AppError("ERR_NO_FILE_UPLOADED");

  const origem = arquivoEnviado.path;
  const nomeFinal = `figurinha-${Date.now()}-${crypto.randomBytes(12).toString("hex")}.webp`;
  const destino = path.resolve(uploadConfig.directory, nomeFinal);

  let resultado;
  try {
    resultado = await converterParaFigurinha(origem, destino, arquivoEnviado.mimetype);
  } catch (err) {
    // A mensagem do conversor explica o motivo real (tamanho, formato), e é ela
    // que ajuda o atendente a escolher outra imagem.
    throw new AppError(err.message);
  } finally {
    // O original não serve para mais nada depois de convertido, mesmo quando a
    // conversão falha -- sem isto, cada tentativa frustrada deixaria lixo.
    await unlink(origem).catch(() => undefined);
  }

  const sticker = await Sticker.create({
    name,
    fileName: nomeFinal,
    animated: resultado.animada,
    size: resultado.tamanho,
    companyId
  });

  return sticker;
};

export default CreateStickerService;
