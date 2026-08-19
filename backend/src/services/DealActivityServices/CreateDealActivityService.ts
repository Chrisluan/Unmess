import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import DealActivity from "../../models/DealActivity";
import User from "../../models/User";
import { ehTipoDeTarefaValido } from "../../helpers/TiposDeTarefa";

interface Request {
  dealId: string | number;
  type?: string;
  body: string;
  dueAt?: Date;
  taskKind?: string;
  companyId: number;
  userId?: number;
}

// Só nota e tarefa podem ser criadas à mão; os demais tipos são carimbos do
// sistema e não devem aceitar texto vindo da requisição.
const TIPOS_MANUAIS = ["note", "task"];

const CreateDealActivityService = async ({
  dealId,
  type = "note",
  body,
  dueAt,
  taskKind,
  companyId,
  userId
}: Request): Promise<DealActivity> => {
  if (!TIPOS_MANUAIS.includes(type)) {
    throw new AppError("ERR_INVALID_DEAL_ACTIVITY_TYPE");
  }

  const deal = await Deal.findOne({ where: { id: dealId, companyId } });

  if (!deal) {
    throw new AppError("ERR_NO_DEAL_FOUND", 404);
  }

  // Categoria só existe em tarefa, e só se for uma das conhecidas: aceitar
  // texto livre aqui encheria os filtros de variações da mesma coisa.
  if (taskKind && !ehTipoDeTarefaValido(taskKind)) {
    throw new AppError("ERR_INVALID_TASK_KIND");
  }
  const activity = await DealActivity.create({
    type,
    body,
    dueAt: type === "task" ? dueAt || null : null,
    taskKind: type === "task" ? taskKind || null : null,
    dealId: deal.id,
    userId: userId || null,
    companyId
  });

  await activity.reload({
    include: [{ model: User, as: "user", attributes: ["id", "name"] }]
  });

  return activity;
};

export default CreateDealActivityService;
