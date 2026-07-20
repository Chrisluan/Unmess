import Queue from "../models/Queue";

// Retorna o setor marcado como padrão (isDefault) da empresa, se existir.
// Usado sempre que um ticket ficaria sem setor (transferência que remove a
// fila, ou roteamento inicial que não encontrou setor específico), para que
// o ticket nunca fique órfão de setor.
const GetDefaultQueue = async (companyId: number): Promise<Queue | null> => {
  const defaultQueue = await Queue.findOne({
    where: { isDefault: true, companyId }
  });

  return defaultQueue;
};

export default GetDefaultQueue;
