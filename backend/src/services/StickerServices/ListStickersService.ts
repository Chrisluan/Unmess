import { Op, WhereOptions } from "sequelize";
import Sticker from "../../models/Sticker";

interface Request {
  companyId: number;
  searchParam?: string;
}

/**
 * Figurinhas da empresa, em ordem alfabética.
 *
 * Sem paginação de propósito: uma biblioteca de figurinhas de atendimento tem
 * dezenas de itens, não milhares, e a gaveta precisa mostrar tudo de uma vez
 * para o atendente achar no olho durante uma conversa.
 */
const ListStickersService = async ({
  companyId,
  searchParam
}: Request): Promise<Sticker[]> => {
  const where: WhereOptions = { companyId };

  if (searchParam?.trim()) {
    (where as Record<string, unknown>).name = {
      [Op.like]: `%${searchParam.trim()}%`
    };
  }

  return Sticker.findAll({
    where,
    order: [["name", "ASC"]]
  });
};

export default ListStickersService;
