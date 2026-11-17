import { Op } from "sequelize";

import Company from "../models/Company";
import CompanyInvoice from "../models/CompanyInvoice";
import User from "../models/User";
import { logger } from "../utils/logger";
import {
  MOTIVO_AUTOMATICO,
  faturasVencidas
} from "../services/BillingServices/GerenciarFaturaService";

const INTERVALO_MS = 60 * 60 * 1000; // 1 hora

/**
 * Suspende quem passou da tolerância e devolve o acesso a quem quitou.
 *
 * Roda no servidor e não na tela: o bloqueio precisa acontecer mesmo com o
 * navegador de todo mundo fechado, e principalmente do lado de quem devia —
 * que é justamente quem não vai abrir o painel para se bloquear.
 *
 * Só age em empresa com `blockWhenOverdue` ligado. É decisão comercial, não
 * regra do produto: nem todo assinante em atraso deve perder o acesso no
 * mesmo dia, e algumas contas nunca devem ser cortadas automaticamente.
 *
 * A reativação é limitada às empresas que o próprio job suspendeu, marcadas
 * pelo motivo. Uma empresa suspensa à mão continua suspensa mesmo que pague:
 * quem cortou por outro motivo é quem decide voltar.
 */
export const rodarBloqueioPorInadimplencia = async (): Promise<void> => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);

    // Só as que ligaram a automação — as demais nem entram na conta.
    const empresas = await Company.findAll({
      where: { blockWhenOverdue: true },
      attributes: [
        "id",
        "name",
        "status",
        "statusReason",
        "overdueGraceDays",
        "blockWhenOverdue"
      ]
    });

    for (const empresa of empresas) {
      // eslint-disable-next-line no-await-in-loop
      const vencidas = await faturasVencidas(
        empresa.id,
        empresa.overdueGraceDays
      );

      const situacao = empresa.getDataValue("status");

      if (vencidas.length > 0 && situacao === "active") {
        // eslint-disable-next-line no-await-in-loop
        await empresa.update({
          status: "suspended",
          statusReason: MOTIVO_AUTOMATICO,
          statusChangedAt: new Date()
        });
        // eslint-disable-next-line no-await-in-loop
        await User.increment("tokenVersion", {
          where: { companyId: empresa.id }
        });
        logger.info(
          `Empresa ${empresa.id} (${empresa.name}) suspensa: ${vencidas.length} fatura(s) vencida(s).`
        );
        continue;
      }

      if (
        vencidas.length === 0 &&
        situacao !== "active" &&
        empresa.getDataValue("statusReason") === MOTIVO_AUTOMATICO
      ) {
        // eslint-disable-next-line no-await-in-loop
        await empresa.update({
          status: "active",
          statusReason: null,
          statusChangedAt: new Date()
        });
        logger.info(
          `Empresa ${empresa.id} (${empresa.name}) reativada: nada vencido em aberto.`
        );
      }
    }

    /**
     * Marca como vencida a fatura em aberto cuja data passou.
     *
     * A situação já é deduzida na leitura, mas gravar deixa a consulta por
     * "vencidas" possível no banco e mantém o histórico coerente para quem
     * olhar a tabela direto.
     */
    await CompanyInvoice.update(
      { status: "overdue" },
      { where: { status: "pending", dueDate: { [Op.lt]: hoje } } }
    );
  } catch (erro) {
    logger.error(
      `Falha no job de bloqueio por inadimplencia: ${(erro as Error).message}`
    );
  }
};

export const startBloqueioPorInadimplenciaJob = (): void => {
  // Uma passada logo ao subir: se o servidor ficou fora durante a virada de
  // um vencimento, ninguém precisa esperar a próxima hora cheia.
  setTimeout(rodarBloqueioPorInadimplencia, 30 * 1000);
  setInterval(rodarBloqueioPorInadimplencia, INTERVALO_MS);
  logger.info("Job de bloqueio por inadimplencia iniciado.");
};
