import User from "../models/User";
import { logger } from "../utils/logger";

/**
 * Zera a presença de todos os usuários. Chamado no boot: se o processo caiu
 * com atendentes marcados como online, esse estado ficou preso no banco.
 */
export const resetAllUsersPresence = async (): Promise<void> => {
  try {
    await User.update({ online: false }, { where: { online: true } });
    logger.info("User presence reset on boot.");
  } catch (error) {
    logger.error(`Error resetting user presence: ${error}`);
  }
};

export default resetAllUsersPresence;
