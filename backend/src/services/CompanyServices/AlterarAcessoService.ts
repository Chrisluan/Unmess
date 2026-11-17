import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";
import { logger } from "../../utils/logger";

interface Request {
  companyId: number;
  /** active | suspended | canceled */
  status: string;
  reason?: string;
  /**
   * Derruba quem já está logado. Sem isso a empresa suspensa continua
   * operando com o token que já tinha na mão até ele expirar.
   */
  encerrarSessoes?: boolean;
}

const SITUACOES = ["active", "suspended", "canceled"];

/**
 * Bloqueia ou libera o acesso de uma empresa inteira.
 *
 * O campo `status` existia desde o começo e nunca foi consultado em lugar
 * nenhum: dava para marcar "Suspensa" na tela e os usuários continuavam
 * entrando normalmente. Agora `AuthUserService` e `RefreshTokenService`
 * verificam, e aqui está o único lugar que muda o valor — junto com o motivo
 * e a data, que a tela de login usa para explicar a quem ficou de fora.
 *
 * Encerrar as sessões é o que faz o bloqueio valer agora e não daqui a alguns
 * minutos: `tokenVersion` invalida os refresh tokens já emitidos, então na
 * próxima renovação — que o frontend faz sozinho — o usuário cai.
 */
const AlterarAcessoService = async ({
  companyId,
  status,
  reason,
  encerrarSessoes = true
}: Request): Promise<Company> => {
  if (!SITUACOES.includes(status)) {
    throw new AppError("ERR_INVALID_COMPANY_STATUS", 400);
  }

  const company = await Company.findByPk(companyId);

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const bloqueando = status !== "active";

  await company.update({
    status,
    statusReason: bloqueando ? reason || null : null,
    statusChangedAt: new Date()
  });

  if (bloqueando && encerrarSessoes) {
    await User.increment("tokenVersion", { where: { companyId } });
    logger.info(
      `Empresa ${companyId} (${company.name}) passou a "${status}"; sessões encerradas.`
    );
  } else {
    logger.info(`Empresa ${companyId} (${company.name}) passou a "${status}".`);
  }

  await company.reload();
  return company;
};

export default AlterarAcessoService;
