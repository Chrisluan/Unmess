import WppKey from "../../models/WppKey";
import { logger } from "../../utils/logger";

/**
 * Apaga as chaves Signal persistidas no banco para uma conexão. Chamado ao
 * deslogar/reparear: sem isso o novo pareamento leria chaves da sessão antiga
 * e falharia ao decriptar. O upsert sozinho não resolve, porque as chaves do
 * pareamento anterior têm outros ids e nunca seriam sobrescritas.
 */
const ClearWppSessionKeys = async (connectionId: number): Promise<void> => {
  try {
    const removed = await WppKey.destroy({ where: { connectionId } });
    logger.info({ info: "Cleared database session keys", connectionId, removed });
  } catch (err) {
    logger.error({
      info: "Error clearing database session keys",
      connectionId,
      err
    });
  }
};

export default ClearWppSessionKeys;
