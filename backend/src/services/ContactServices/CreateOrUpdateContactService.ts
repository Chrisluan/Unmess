import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Customer from "../../models/Customer";
import Deal from "../../models/Deal";
import { logger } from "../../utils/logger";
import { digitosDoLid, numeroEhLid } from "../../helpers/ChatIdDoContato";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  lid?: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  companyId: number;
}

const emitContact = (action: "update" | "create", contact: Contact) => {
  const io = getIO();

  io.to(`company-${contact.companyId}`).emit("contact", { action, contact });
};

const CreateOrUpdateContactService = async ({
  name,
  number: rawNumber,
  lid,
  profilePicUrl,
  isGroup,
  email = "",
  extraInfo = [],
  companyId
}: Request): Promise<Contact> => {
  const limpo = isGroup ? rawNumber : (rawNumber || "").replace(/[^0-9]/g, "");

  // Os dígitos do LID não são telefone. Chegando como "número", eles
  // sobrescreviam o telefone real do cadastro (achado pelo LID) ou criavam um
  // cadastro duplicado. Aqui eles valem como "telefone desconhecido".
  const number = !isGroup && lid && limpo === digitosDoLid(lid) ? "" : limpo;

  if (!number && !lid) throw new Error("Either number or lid must be provided");

  const [contactByNumber, contactByLid] = await Promise.all([
    number ? Contact.findOne({ where: { number, companyId } }) : null,
    lid ? Contact.findOne({ where: { lid, companyId } }) : null
  ]);

  const shouldMerge =
    contactByNumber && contactByLid && contactByNumber.id !== contactByLid.id;

  if (shouldMerge) {
    /**
     * Tudo que aponta para o cadastro duplicado passa para o verdadeiro antes
     * de ele ser apagado. Mensagens apontam para o contato com ON DELETE
     * CASCADE: mover só os tickets e apagar o duplicado levava junto as
     * mensagens dele — o histórico da conversa sumia na fusão.
     */
    const de = { where: { contactId: contactByLid.id } };
    const para = { contactId: contactByNumber.id };

    await Contact.sequelize!.transaction(async transaction => {
      await Ticket.update(para, { ...de, where: { ...de.where, companyId }, transaction });
      await Message.update(para, { ...de, transaction });
      await Customer.update(para, { ...de, transaction });
      await Deal.update(para, { ...de, transaction });
      await contactByLid.destroy({ transaction });
    });

    await contactByNumber.update({
      lid: contactByLid.lid,
      profilePicUrl
    });

    logger.info({
      info: "Merged contacts by number and lid",
      primaryContactId: contactByNumber.id,
      mergedContactId: contactByLid.id
    });

    emitContact("update", contactByNumber);

    return contactByNumber;
  }

  if (contactByNumber) {
    await contactByNumber.update({
      lid: lid || contactByNumber.lid,
      profilePicUrl
    });

    emitContact("update", contactByNumber);

    return contactByNumber;
  }

  if (contactByLid) {
    // Só um telefone de verdade substitui o que está gravado — e só quando o
    // gravado é o LID ocupando o lugar. Telefone real nunca é trocado.
    const podeTrocarNumero = Boolean(number) && numeroEhLid(contactByLid);
    await contactByLid.update({
      number: podeTrocarNumero ? number : contactByLid.number,
      profilePicUrl
    });

    emitContact("update", contactByLid);
    return contactByLid;
  }

  let created: Contact;
  try {
    created = await Contact.create({
      name,
      // Sem telefone conhecido a coluna recebe os dígitos do LID: ela é
      // obrigatória e única por empresa. O envio sabe reconhecer esse caso
      // (ChatIdDoContato) e a primeira mensagem que trouxer o telefone o grava.
      number: number || digitosDoLid(lid),
      lid,
      profilePicUrl,
      email,
      isGroup,
      extraInfo,
      companyId
    });
  } catch (err) {
    // Duas mensagens do mesmo contato novo chegando juntas: as duas olham, as
    // duas não acham, as duas tentam criar. A segunda batia na chave única e
    // a mensagem inteira era perdida. Quem perde a corrida usa o que a outra
    // acabou de gravar.
    if ((err as { name?: string })?.name !== "SequelizeUniqueConstraintError") {
      throw err;
    }

    const existente =
      (number ? await Contact.findOne({ where: { number, companyId } }) : null) ||
      (lid ? await Contact.findOne({ where: { lid, companyId } }) : null);

    if (!existente) throw err;
    return existente;
  }

  emitContact("create", created);
  return created;
};

export default CreateOrUpdateContactService;
