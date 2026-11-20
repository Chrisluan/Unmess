import { Op } from "sequelize";
import { subHours } from "date-fns";

import Ticket from "../models/Ticket";
import Company from "../models/Company";
import Setting from "../models/Setting";
import TicketStatus from "../models/TicketStatus";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import { GetSettingBoolean } from "../helpers/GetSetting";
import { logger } from "../utils/logger";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

// Empresas já avisadas de que falta o status padrão, para não repetir o aviso
// a cada ciclo.
const empresasAvisadas = new Set<number>();

/**
 * Encerra automaticamente chats parados há mais de X horas.
 *
 * Antes isso era feito no frontend (hook useTickets), o que significava que só
 * fechava se algum atendente estivesse com a tela aberta, e cada aberta de tela
 * disparava um PUT por ticket. Agora roda no servidor, uma vez por empresa.
 *
 * A chave `autoCloseInactiveHours` vazia ou 0 desliga a automação.
 */
export const runCloseInactiveTickets = async (): Promise<void> => {
  try {
    const settings = await Setting.findAll({
      where: { key: "autoCloseInactiveHours" }
    });

    for (const setting of settings) {
      const hours = Number(setting.value);

      if (!Number.isFinite(hours) || hours <= 0) continue;

      const cutoff = subHours(new Date(), hours);
      const { companyId } = setting;

      // O encerramento automático passa pela mesma regra do manual: se a
      // empresa exige status de encerramento, o robô também precisa de um.
      // Ele usa o status marcado como padrão do tipo "encerrado" -- é a
      // empresa quem decide o que um chat abandonado significa no relatório.
      // eslint-disable-next-line no-await-in-loop
      const statusPadrao = await TicketStatus.findOne({
        where: { companyId, type: "closed", isDefault: true },
        attributes: ["id"]
      });

      // eslint-disable-next-line no-await-in-loop
      const exigeStatus = await GetSettingBoolean(
        "requireClosingStatus",
        companyId,
        false
      );

      if (exigeStatus && !statusPadrao) {
        // Sem isto, cada ticket parado falhava a cada ciclo e o log enchia de
        // erros iguais. Avisa uma vez e espera a configuração.
        if (!empresasAvisadas.has(companyId)) {
          empresasAvisadas.add(companyId);
          logger.warn(
            `CloseInactiveTickets: empresa ${companyId} exige status de encerramento mas não tem um status do tipo "encerrado" marcado como padrão; encerramento automático suspenso até que um seja marcado.`
          );
        }
        continue;
      }
      empresasAvisadas.delete(companyId);

      // eslint-disable-next-line no-await-in-loop
      const staleTickets = await Ticket.findAll({
        where: {
          companyId: setting.companyId,
          status: { [Op.in]: ["open", "pending"] },
          updatedAt: { [Op.lt]: cutoff }
        },
        attributes: ["id"]
      });

      for (const stale of staleTickets) {
        try {
          // Passa pelo service para manter socket, métricas e regras de
          // encerramento consistentes com o fechamento manual.
          // eslint-disable-next-line no-await-in-loop
          await UpdateTicketService({
            ticketData: { status: "closed", closingStatusId: statusPadrao?.id },
            ticketId: stale.id,
            companyId: setting.companyId
          });
        } catch (error) {
          logger.error(
            `CloseInactiveTickets: falha ao encerrar ticket ${stale.id}: ${error}`
          );
        }
      }

      if (staleTickets.length > 0) {
        logger.info(
          `CloseInactiveTickets: ${staleTickets.length} chat(s) encerrado(s) na empresa ${setting.companyId}.`
        );
      }
    }
  } catch (error) {
    logger.error(`CloseInactiveTickets: erro no ciclo: ${error}`);
  }
};

export const startCloseInactiveTicketsJob = (): NodeJS.Timeout => {
  logger.info("CloseInactiveTickets job iniciado (ciclo de 5 min).");
  // Não roda imediatamente no boot: dá tempo das sessões subirem.
  return setInterval(runCloseInactiveTickets, INTERVAL_MS);
};

// Import mantido para garantir que o model Company esteja registrado antes
// do primeiro ciclo em ambientes onde a ordem de import varia.
export type { Company };
