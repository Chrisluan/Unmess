import { Regra } from "./tipos";

/**
 * As regras de consistência entre configurações.
 *
 * Cada uma nasceu de um caso em que um recurso ligado não fazia nada -- ou
 * fazia o errado -- porque outra configuração faltava, e ninguém era avisado.
 * O primeiro foi o fechamento automático da PrintPlus: ligado, exigindo motivo
 * de encerramento, sem motivo padrão. Nunca fechou um chat sequer.
 *
 * Para acrescentar uma regra: escolha os gatilhos (o que, ao mudar, pode criar
 * ou resolver o problema) e escreva `verificar` só com a `FonteDeDados`.
 * Regras de "bloqueia" precisam que todo serviço que grava num gatilho dela
 * passe por `comConsistencia`; do contrário o problema só aparece no painel.
 */

const ligado = (valor: string): boolean => valor === "enabled" || valor === "true";

const minutos = (hora: string): number => {
  const [h, m] = String(hora || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

const AJUSTES = (aba: string) => `/Settings?aba=${aba}`;

export const REGRAS: Regra[] = [
  // ── Atendimento ──────────────────────────────────────────────────────────
  {
    id: "fechamento-automatico-sem-motivo-padrao",
    titulo: "Fechamento automático sem motivo padrão",
    severidade: "bloqueia",
    gatilhos: ["configuracao", "statusDeTicket"],
    resolver: { rota: AJUSTES("status"), rotulo: "Marcar um motivo como padrão" },
    verificar: async dados => {
      const horas = Number(await dados.configuracao("autoCloseInactiveHours"));
      if (!(horas > 0)) return [];
      if (!ligado(await dados.configuracao("requireClosingStatus"))) return [];
      const status = await dados.statusDeTicket();
      if (status.some(s => s.type === "closed" && s.isDefault)) return [];
      return [
        `O fechamento automático (após ${horas} h) precisa de um motivo de encerramento padrão, porque a empresa exige motivo ao encerrar. Sem ele, nenhum chat é fechado.`
      ];
    }
  },
  {
    id: "motivo-obrigatorio-sem-motivos",
    titulo: "Motivo de encerramento obrigatório sem motivos cadastrados",
    severidade: "bloqueia",
    gatilhos: ["configuracao", "statusDeTicket"],
    resolver: { rota: AJUSTES("status"), rotulo: "Cadastrar motivos" },
    verificar: async dados => {
      if (!ligado(await dados.configuracao("requireClosingStatus"))) return [];
      const status = await dados.statusDeTicket();
      if (status.some(s => s.type === "closed")) return [];
      return [
        "A empresa exige motivo ao encerrar, mas não há nenhum motivo do tipo \"encerrado\". Ninguém consegue encerrar uma conversa."
      ];
    }
  },
  {
    id: "fora-do-horario-sem-texto",
    titulo: "Mensagem fora do horário sem texto",
    severidade: "bloqueia",
    gatilhos: ["configuracao"],
    resolver: { rota: AJUSTES("mensagens"), rotulo: "Escrever a mensagem" },
    verificar: async dados => {
      if (!ligado(await dados.configuracao("outOfHoursMessageEnabled"))) return [];
      if ((await dados.configuracao("outOfHoursMessage")).trim()) return [];
      return ["A mensagem fora do horário está ligada, mas sem texto: nada é enviado ao cliente."];
    }
  },
  {
    id: "fora-do-horario-sem-horario",
    titulo: "Mensagem fora do horário sem horário de atendimento",
    severidade: "bloqueia",
    gatilhos: ["configuracao", "horario"],
    resolver: { rota: AJUSTES("horarios"), rotulo: "Definir o horário" },
    verificar: async dados => {
      if (!ligado(await dados.configuracao("outOfHoursMessageEnabled"))) return [];
      const dias = await dados.horarios();
      const valido = dias.some(
        d => d.enabled && minutos(d.startTime) < minutos(d.endTime)
      );
      if (valido) return [];
      return [
        dias.length === 0
          ? "A mensagem fora do horário está ligada, mas não há horário de atendimento: o sistema considera a empresa sempre aberta e a mensagem nunca sai."
          : "A mensagem fora do horário está ligada, mas nenhum dia tem horário válido (aberto, com início antes do fim): a mensagem sairia em toda conversa nova."
      ];
    }
  },
  {
    id: "horario-com-inicio-depois-do-fim",
    titulo: "Dia com início depois do fim",
    severidade: "bloqueia",
    gatilhos: ["horario"],
    resolver: { rota: AJUSTES("horarios"), rotulo: "Corrigir o horário" },
    verificar: async dados => {
      const nomes = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
      return (await dados.horarios())
        .filter(d => d.enabled && !(minutos(d.startTime) < minutos(d.endTime)))
        .map(
          d =>
            `${nomes[d.weekDay] ?? `Dia ${d.weekDay}`}: o horário de início (${d.startTime}) não é anterior ao de fim (${d.endTime}). Nesse dia a empresa ficaria sempre fechada.`
        );
    }
  },
  {
    id: "transferencia-sem-texto",
    titulo: "Mensagem de transferência sem texto",
    severidade: "bloqueia",
    gatilhos: ["configuracao"],
    resolver: { rota: AJUSTES("mensagens"), rotulo: "Escrever a mensagem" },
    verificar: async dados => {
      if (!ligado(await dados.configuracao("transferMessageEnabled"))) return [];
      if ((await dados.configuracao("transferMessage")).trim()) return [];
      return ["A mensagem de transferência está ligada, mas sem texto: nada é enviado ao cliente."];
    }
  },
  {
    id: "distribuicao-sem-atendente-na-fila-padrao",
    titulo: "Distribuição automática com fila padrão vazia",
    severidade: "bloqueia",
    gatilhos: ["configuracao", "fila"],
    resolver: { rota: "/Queues", rotulo: "Pôr atendentes na fila" },
    verificar: async dados => {
      if (!ligado(await dados.configuracao("autoAssignTickets"))) return [];
      const padrao = (await dados.filas()).find(f => f.isDefault);
      if (!padrao || padrao.usuarios > 0) return [];
      return [
        `A distribuição automática está ligada e toda conversa nova entra na fila padrão "${padrao.name}", que não tem nenhum atendente. Nenhuma conversa é distribuída.`
      ];
    }
  },
  {
    id: "fila-padrao-desliga-menu",
    titulo: "Fila padrão impede o menu de filas",
    severidade: "aviso",
    gatilhos: ["fila", "conexao"],
    resolver: { rota: "/Queues", rotulo: "Rever a fila padrão" },
    verificar: async dados => {
      const padrao = (await dados.filas()).find(f => f.isDefault);
      if (!padrao) return [];
      return (await dados.conexoes())
        .filter(c => c.filas.length > 1)
        .map(
          c =>
            `A conexão "${c.name}" tem ${c.filas.length} filas e saudação com menu, mas toda conversa nova já entra na fila padrão "${padrao.name}": o cliente nunca vê o menu.`
        );
    }
  },
  {
    id: "nenhuma-conexao-conectada",
    titulo: "Nenhum número de WhatsApp conectado",
    severidade: "aviso",
    gatilhos: ["conexao"],
    resolver: { rota: AJUSTES("conexoes"), rotulo: "Ver conexões" },
    verificar: async dados => {
      const conexoes = await dados.conexoes();
      if (conexoes.length === 0 || conexoes.some(c => c.status === "CONNECTED")) return [];
      return ["Nenhum número está conectado: mensagens não chegam nem saem."];
    }
  },

  // ── CRM ──────────────────────────────────────────────────────────────────
  {
    id: "sem-quadro-de-vendas",
    titulo: "Nenhum quadro marcado como funil de vendas",
    severidade: "bloqueia",
    gatilhos: ["quadro"],
    resolver: { rota: "/crm", rotulo: "Configurar quadros" },
    verificar: async dados => {
      const quadros = await dados.quadros();
      if (quadros.length === 0 || quadros.some(q => q.isSalesFunnel)) return [];
      return [
        "Nenhum quadro é o funil de vendas: cards novos ganham número de pedido em vez de orçamento, e concluir uma venda não gera pedido."
      ];
    }
  },
  {
    id: "funil-sem-etapa-de-ganho",
    titulo: "Funil de vendas sem etapa de ganho",
    severidade: "bloqueia",
    gatilhos: ["quadro", "etapa"],
    resolver: { rota: "/crm", rotulo: "Marcar a etapa de ganho" },
    verificar: async dados => {
      const funil = (await dados.quadros()).find(q => q.isSalesFunnel);
      if (!funil) return [];
      const etapas = (await dados.etapas()).filter(e => e.boardId === funil.id);
      if (etapas.some(e => e.isWon && e.active)) return [];
      return [
        `O funil "${funil.name}" não tem etapa ativa marcada como ganho: a venda só conta como ganha no fim de todo o processo, e a cobrança fica para depois da entrega.`
      ];
    }
  },
  {
    id: "quadro-sem-saida",
    titulo: "Quadro sem etapa final",
    severidade: "bloqueia",
    gatilhos: ["quadro", "etapa"],
    resolver: { rota: "/crm", rotulo: "Configurar etapas" },
    verificar: async dados => {
      const etapas = await dados.etapas();
      return (await dados.quadros())
        .filter(q => !etapas.some(e => e.boardId === q.id && e.isFinal && e.active))
        .map(q => `O quadro "${q.name}" não tem etapa final ativa: nenhum card consegue sair dele.`);
    }
  },
  {
    id: "destino-de-etapa-invalido",
    titulo: "Etapa final aponta para destino inutilizável",
    severidade: "bloqueia",
    gatilhos: ["quadro", "etapa"],
    resolver: { rota: "/crm", rotulo: "Corrigir o destino" },
    verificar: async dados => {
      const etapas = await dados.etapas();
      const quadros = await dados.quadros();
      const problemas: string[] = [];

      etapas
        .filter(e => e.isFinal && e.active)
        .forEach(e => {
          if (e.targetStageId) {
            const alvo = etapas.find(a => a.id === e.targetStageId);
            if (!alvo || !alvo.active) {
              problemas.push(
                `A etapa "${e.name}" manda os cards para uma etapa ${alvo ? "desativada" : "que não existe mais"}.`
              );
            }
            return;
          }
          if (e.targetBoardId) {
            const quadro = quadros.find(q => q.id === e.targetBoardId);
            const temEntrada = etapas.some(
              a => a.boardId === e.targetBoardId && a.active && a.isInitial
            );
            if (!quadro || !temEntrada) {
              problemas.push(
                `A etapa "${e.name}" manda os cards para o quadro ${quadro ? `"${quadro.name}", que não tem etapa de entrada ativa` : "que não existe mais"}.`
              );
            }
          }
        });

      return problemas;
    }
  },

  // ── Documentos ───────────────────────────────────────────────────────────
  {
    id: "documentos-sem-dados-da-empresa",
    titulo: "Documentos sem os dados da empresa",
    severidade: "aviso",
    gatilhos: ["empresa"],
    resolver: { rota: AJUSTES("marca"), rotulo: "Preencher os dados da empresa" },
    verificar: async dados => {
      const empresa = await dados.empresa();
      if (!empresa) return [];
      const faltando = [
        !empresa.document ? "CNPJ/CPF" : null,
        !empresa.address ? "endereço" : null
      ].filter(Boolean);
      if (faltando.length === 0) return [];
      return [
        `A proposta, a ordem de produção e a cobrança saem sem ${faltando.join(" e ")} da empresa no cabeçalho.`
      ];
    }
  },

  // ── Financeiro ───────────────────────────────────────────────────────────
  {
    id: "pdv-sem-conta-caixa",
    titulo: "Frente de caixa sem conta do tipo caixa",
    severidade: "aviso",
    gatilhos: ["financeiro"],
    resolver: { rota: "/finance/configuracao", rotulo: "Cadastrar conta caixa" },
    verificar: async dados => {
      const contas = await dados.contasFinanceiras();
      if (contas.length === 0 || contas.some(c => c.kind === "cash" && c.active)) return [];
      return ["Não há conta financeira ativa do tipo caixa: o PDV não abre."];
    }
  }
];
