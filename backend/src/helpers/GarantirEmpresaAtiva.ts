import AppError from "../errors/AppError";
import Company from "../models/Company";
import User from "../models/User";

/**
 * Recusa o acesso de quem pertence a uma empresa bloqueada.
 *
 * `Company.status` existia desde o início e nunca foi consultado: dava para
 * marcar a empresa como "Suspensa" na tela do super e todos os usuários dela
 * continuavam entrando. O bloqueio era um rótulo.
 *
 * Fica em helper, e não dentro de um dos serviços de autenticação, porque são
 * dois caminhos de entrada — login e renovação de token — e um bloqueio que
 * vale só no login demora o tempo de um refresh para acontecer, ou nunca
 * acontece para quem já está com a tela aberta.
 *
 * O super não pertence a nenhuma empresa e nunca é barrado aqui: é justamente
 * ele quem precisa entrar para desbloquear.
 */
const GarantirEmpresaAtiva = async (user: User): Promise<void> => {
  if (user.profile === "super") return;
  if (!user.companyId) return;

  const company = await Company.findByPk(user.companyId, {
    attributes: ["id", "status", "statusReason"]
  });

  // Empresa apagada com usuário sobrando é inconsistência de dados, não
  // permissão: melhor recusar do que deixar entrar num contexto que não
  // existe mais.
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 401);
  }

  if (company.getDataValue("status") === "active") return;

  const motivo = company.getDataValue("statusReason");

  // A mensagem vai para a tela de login. Dizer só "bloqueado" faz o cliente
  // ligar para descobrir o que já podia estar escrito ali.
  throw new AppError(
    motivo
      ? `Acesso suspenso: ${motivo}. Fale com o suporte.`
      : "Acesso suspenso. Fale com o suporte.",
    401
  );
};

export default GarantirEmpresaAtiva;
