import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";

/**
 * Conexão preferencial do usuário.
 *
 * Só retorna a conexão se ela estiver CONNECTED — caso contrário devolve null
 * para que o chamador caia no fallback (conexão padrão / qualquer conectada).
 * Sem essa checagem o sistema tentava enviar por um número offline.
 */
const GetDefaultWhatsAppByUser = async (
  userId: number
): Promise<Whatsapp | null> => {
  const user = await User.findByPk(userId, { include: ["whatsapp"] });

  if (user === null || !user.whatsapp) {
    return null;
  }

  if (user.whatsapp.status !== "CONNECTED") {
    logger.warn(
      `Whatsapp '${user.whatsapp.name}' linked to user '${user.name}' is not connected (status: ${user.whatsapp.status}). Falling back.`
    );
    return null;
  }

  logger.info(
    `Found whatsapp linked to user '${user.name}' is '${user.whatsapp.name}'.`
  );

  return user.whatsapp;
};

export default GetDefaultWhatsAppByUser;
