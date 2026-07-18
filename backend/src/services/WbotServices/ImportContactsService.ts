import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { whatsappProvider } from "../../providers/WhatsApp";
import Contact from "../../models/Contact";
import ShowUserService from "../UserServices/ShowUserService";
import { logger } from "../../utils/logger";

const ImportContactsService = async (userId: number): Promise<void> => {
  const user = await ShowUserService(userId);
  const { companyId } = user;

  const defaultWhatsapp = await GetDefaultWhatsApp(companyId, userId);

  let phoneContacts;

  try {
    phoneContacts = await whatsappProvider.getContacts(defaultWhatsapp.id);
  } catch (err) {
    logger.error(`Could not get whatsapp contacts from phone. Err: ${err}`);
  }

  if (phoneContacts) {
    await Promise.all(
      phoneContacts.map(async ({ number, name }) => {
        if (!number) {
          return null;
        }
        if (!name) {
          name = number;
        }

        const numberExists = await Contact.findOne({
          where: { number, companyId }
        });

        if (numberExists) return null;

        return Contact.create({ number, name, companyId });
      })
    );
  }
};

export default ImportContactsService;
