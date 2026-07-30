import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import GetDefaultWhatsAppByUser from "./GetDefaultWhatsAppByUser";

/**
 * Resolve qual conexão usar para enviar, na seguinte ordem:
 * 1. whatsappId explícito (escolha do atendente na tela) — se for da empresa e estiver conectado
 * 2. Conexão preferencial do usuário (se conectada)
 * 3. Conexão marcada como padrão da empresa
 * 4. Qualquer conexão CONNECTED da empresa
 */
const GetDefaultWhatsApp = async (
  companyId: number,
  userId?: number,
  whatsappId?: number
): Promise<Whatsapp> => {
  if (whatsappId) {
    const chosen = await Whatsapp.findOne({
      where: { id: whatsappId, companyId }
    });

    if (!chosen) {
      throw new AppError("ERR_NO_DEF_WAPP_FOUND");
    }

    if (chosen.status !== "CONNECTED") {
      throw new AppError("ERR_WAPP_NOT_INITIALIZED");
    }

    return chosen;
  }

  if (userId) {
    const whatsappByUser = await GetDefaultWhatsAppByUser(userId);
    if (whatsappByUser !== null) {
      return whatsappByUser;
    }
  }

  const defaultWhatsapp = await Whatsapp.findOne({
    where: { isDefault: true, companyId }
  });

  if (defaultWhatsapp && defaultWhatsapp.status === "CONNECTED") {
    return defaultWhatsapp;
  }

  // Último recurso: qualquer conexão ativa da empresa. Evita travar o
  // atendimento inteiro só porque a conexão marcada como padrão caiu.
  const anyConnected = await Whatsapp.findOne({
    where: { companyId, status: "CONNECTED" }
  });

  if (anyConnected) {
    return anyConnected;
  }

  if (!defaultWhatsapp) {
    throw new AppError("ERR_NO_DEF_WAPP_FOUND");
  }

  return defaultWhatsapp;
};

export default GetDefaultWhatsApp;
