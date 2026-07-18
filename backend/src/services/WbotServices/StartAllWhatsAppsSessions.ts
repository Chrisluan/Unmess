import Whatsapp from "../../models/Whatsapp";
import { StartWhatsAppSession } from "./StartWhatsAppSession";

// Roda no boot da aplicação, antes de qualquer contexto de usuário/empresa
// logado - por isso busca diretamente todas as conexões de todas as
// empresas, em vez de usar o ListWhatsAppsService (que exige companyId).
export const StartAllWhatsAppsSessions = async (): Promise<void> => {
  const whatsapps = await Whatsapp.findAll();
  if (whatsapps.length > 0) {
    whatsapps.forEach(whatsapp => {
      StartWhatsAppSession(whatsapp);
    });
  }
};
