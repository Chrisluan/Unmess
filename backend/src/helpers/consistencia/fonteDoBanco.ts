import { Transaction } from "sequelize";

import Setting from "../../models/Setting";
import TicketStatus from "../../models/TicketStatus";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import BusinessHour from "../../models/BusinessHour";
import Board from "../../models/Board";
import PipelineStage from "../../models/PipelineStage";
import FinancialAccount from "../../models/FinancialAccount";
import { CATALOGO_DE_CONFIGURACOES } from "../configuracoes/catalogo";
import {
  Conexao,
  ContaFinanceira,
  DiaDeAtendimento,
  Etapa,
  Fila,
  FonteDeDados,
  Quadro,
  StatusDeTicket
} from "./tipos";

/**
 * Lê do banco o que as regras pedem, uma vez por verificação.
 *
 * Recebe a transação da alteração em curso: é o que permite enxergar o estado
 * "como ficaria" antes de gravar de vez. Cada leitura é guardada, porque várias
 * regras perguntam a mesma coisa.
 */
const fonteDoBanco = (
  companyId: number,
  transaction?: Transaction
): FonteDeDados => {
  const memoria = new Map<string, Promise<unknown>>();
  const lembrar = <T>(chave: string, ler: () => Promise<T>): Promise<T> => {
    if (!memoria.has(chave)) memoria.set(chave, ler());
    return memoria.get(chave) as Promise<T>;
  };

  const configuracoes = () =>
    lembrar("configuracoes", async () => {
      const linhas = await Setting.findAll({ where: { companyId }, transaction });
      return new Map(linhas.map(l => [l.key, l.value]));
    });

  return {
    configuracao: async chave => {
      const valores = await configuracoes();
      const valor = valores.get(chave);
      if (valor === null || valor === undefined) {
        return CATALOGO_DE_CONFIGURACOES[chave]?.padrao ?? "";
      }
      return valor;
    },

    statusDeTicket: () =>
      lembrar("status", async () => {
        const linhas = await TicketStatus.findAll({ where: { companyId }, transaction });
        return linhas.map<StatusDeTicket>(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          isDefault: Boolean(s.isDefault)
        }));
      }),

    filas: () =>
      lembrar("filas", async () => {
        const linhas = await Queue.findAll({
          where: { companyId },
          include: [
            { model: User, as: "users", attributes: ["id"] },
            { model: Whatsapp, as: "whatsapps", attributes: ["id"] }
          ],
          transaction
        });
        return linhas.map<Fila>(f => ({
          id: f.id,
          name: f.name,
          isDefault: Boolean(f.isDefault),
          usuarios: (f.users || []).length,
          conexoes: (f.whatsapps || []).map(w => w.id)
        }));
      }),

    horarios: () =>
      lembrar("horarios", async () => {
        const linhas = await BusinessHour.findAll({ where: { companyId }, transaction });
        return linhas.map<DiaDeAtendimento>(h => ({
          weekDay: h.weekDay,
          enabled: Boolean(h.enabled),
          startTime: h.startTime,
          endTime: h.endTime
        }));
      }),

    quadros: () =>
      lembrar("quadros", async () => {
        const linhas = await Board.findAll({ where: { companyId }, transaction });
        return linhas.map<Quadro>(b => ({
          id: b.id,
          name: b.name,
          isSalesFunnel: Boolean(b.isSalesFunnel)
        }));
      }),

    etapas: () =>
      lembrar("etapas", async () => {
        const linhas = await PipelineStage.findAll({ where: { companyId }, transaction });
        return linhas.map<Etapa>(e => ({
          id: e.id,
          name: e.name,
          boardId: e.boardId,
          type: e.type,
          isInitial: Boolean(e.isInitial),
          isFinal: Boolean(e.isFinal),
          isWon: Boolean(e.isWon),
          active: e.active !== false,
          targetBoardId: e.targetBoardId ?? null,
          targetStageId: e.targetStageId ?? null
        }));
      }),

    conexoes: () =>
      lembrar("conexoes", async () => {
        const linhas = await Whatsapp.findAll({
          where: { companyId },
          include: [{ model: Queue, as: "queues", attributes: ["id"] }],
          transaction
        });
        return linhas.map<Conexao>(w => ({
          id: w.id,
          name: w.name,
          status: w.status,
          filas: (w.queues || []).map(q => q.id)
        }));
      }),

    contasFinanceiras: () =>
      lembrar("contas", async () => {
        const linhas = await FinancialAccount.findAll({ where: { companyId }, transaction });
        return linhas.map<ContaFinanceira>(c => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          active: c.active !== false
        }));
      })
  };
};

export default fonteDoBanco;
