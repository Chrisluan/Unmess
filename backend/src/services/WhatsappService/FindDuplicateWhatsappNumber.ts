import { Op } from "sequelize";

import Whatsapp from "../../models/Whatsapp";

/**
 * Procura outra conexão da mesma empresa já autenticada no mesmo telefone.
 *
 * Parear duas conexões no mesmo aparelho não dá erro no WhatsApp: elas viram
 * dois dispositivos vinculados da mesma conta e ambas recebem cada mensagem.
 * Como FindOrCreateTicketService separa atendimento por conexão, isso gera
 * dois tickets para toda conversa — sem nenhum sintoma que aponte a causa.
 */
const FindDuplicateWhatsappNumber = async (
  number: string,
  companyId: number,
  currentWhatsappId: number
): Promise<Whatsapp | null> => {
  if (!number) return null;

  return Whatsapp.findOne({
    where: {
      number,
      companyId,
      id: { [Op.ne]: currentWhatsappId }
    }
  });
};

export default FindDuplicateWhatsappNumber;
