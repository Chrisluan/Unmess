import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  companyId: number;
}

const CreateContactService = async ({
  name,
  number: rawNumber,
  email = "",
  extraInfo = [],
  companyId
}: Request): Promise<Contact> => {
  /**
   * Só dígitos, sempre.
   *
   * Quem chama pode entregar um JID inteiro ("5544xxxxxxxxx@s.whatsapp.net"),
   * e o domínio gravado aqui torna o contato invisível para o atendimento --
   * que procura pelo número normalizado. O resultado era um segundo cadastro,
   * e um atendimento duplicado, na primeira mensagem recebida.
   */
  const number = rawNumber.replace(/[^0-9]/g, "");

  const numberExists = await Contact.findOne({
    where: { number, companyId }
  });

  if (numberExists) {
    throw new AppError("ERR_DUPLICATED_CONTACT");
  }

  const contact = await Contact.create(
    {
      name,
      number,
      email,
      extraInfo,
      companyId
    },
    {
      include: ["extraInfo"]
    }
  );

  return contact;
};

export default CreateContactService;
