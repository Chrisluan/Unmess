import fs from "fs";
import path from "path";

import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import { logger } from "../../utils/logger";
import ShowBrandingService, { Branding } from "./ShowBrandingService";

interface Request {
  companyId: number;
  name?: string;
  /** Arquivo recém-enviado; ausente quando só o nome mudou. */
  logoFile?: Express.Multer.File;
  /** Remove a logo atual e volta ao nome em texto. */
  removeLogo?: boolean;
}

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

const apagarArquivo = (arquivo: string | null) => {
  if (!arquivo) return;
  try {
    const caminho = path.join(publicFolder, path.basename(arquivo));
    if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
  } catch (err) {
    // Falhar em apagar a imagem antiga não pode impedir a troca da nova.
    logger.warn({ info: "Could not remove old company logo", arquivo, err });
  }
};

const UpdateBrandingService = async ({
  companyId,
  name,
  logoFile,
  removeLogo
}: Request): Promise<Branding> => {
  const company = await Company.findByPk(companyId);

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const dados: { name?: string; logo?: string | null } = {};

  if (name !== undefined) {
    const limpo = name.trim();
    if (!limpo) throw new AppError("ERR_COMPANY_NAME_REQUIRED");
    dados.name = limpo;
  }

  // getDataValue devolve o nome do arquivo em disco; o getter da coluna
  // devolveria o caminho já montado, que não serve para apagar.
  const logoAtual = company.getDataValue("logo") as string | null;

  if (logoFile) {
    dados.logo = logoFile.filename;
    apagarArquivo(logoAtual);
  } else if (removeLogo) {
    dados.logo = null;
    apagarArquivo(logoAtual);
  }

  await company.update(dados);

  return ShowBrandingService(companyId);
};

export default UpdateBrandingService;
