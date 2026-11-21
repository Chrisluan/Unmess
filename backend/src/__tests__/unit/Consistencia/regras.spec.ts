import { REGRAS } from "../../../helpers/consistencia/regras";
import { FonteDeDados } from "../../../helpers/consistencia/tipos";
import { CATALOGO_DE_CONFIGURACOES } from "../../../helpers/configuracoes/catalogo";

/**
 * As regras são funções puras sobre uma FonteDeDados: aqui os dados são de
 * mentira, montados por caso, sem banco.
 */
type Dados = {
  configuracoes?: Record<string, string>;
  status?: Awaited<ReturnType<FonteDeDados["statusDeTicket"]>>;
  filas?: Awaited<ReturnType<FonteDeDados["filas"]>>;
  horarios?: Awaited<ReturnType<FonteDeDados["horarios"]>>;
  quadros?: Awaited<ReturnType<FonteDeDados["quadros"]>>;
  etapas?: Awaited<ReturnType<FonteDeDados["etapas"]>>;
  conexoes?: Awaited<ReturnType<FonteDeDados["conexoes"]>>;
  contas?: Awaited<ReturnType<FonteDeDados["contasFinanceiras"]>>;
  produtos?: Awaited<ReturnType<FonteDeDados["produtosCalculados"]>>;
};

const fonte = (d: Dados): FonteDeDados => ({
  configuracao: async chave =>
    d.configuracoes?.[chave] ?? CATALOGO_DE_CONFIGURACOES[chave]?.padrao ?? "",
  statusDeTicket: async () => d.status ?? [],
  filas: async () => d.filas ?? [],
  horarios: async () => d.horarios ?? [],
  quadros: async () => d.quadros ?? [],
  etapas: async () => d.etapas ?? [],
  conexoes: async () => d.conexoes ?? [],
  contasFinanceiras: async () => d.contas ?? [],
  empresa: async () => null,
  produtosCalculados: async () => d.produtos ?? []
});

const rodar = async (id: string, d: Dados): Promise<string[]> => {
  const regra = REGRAS.find(r => r.id === id);
  if (!regra) throw new Error(`regra ${id} não existe`);
  return regra.verificar(fonte(d));
};

const etapa = (parcial: Partial<Awaited<ReturnType<FonteDeDados["etapas"]>>[number]>) => ({
  id: 1,
  name: "Etapa",
  boardId: 1,
  type: "open",
  isInitial: false,
  isFinal: false,
  isWon: false,
  active: true,
  targetBoardId: null,
  targetStageId: null,
  ...parcial
});

describe("Regras de consistência de configuração", () => {
  it("os ids são únicos", () => {
    const ids = REGRAS.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe("fechamento automático sem motivo padrão (o caso da PrintPlus)", () => {
    const base = {
      configuracoes: { autoCloseInactiveHours: "5", requireClosingStatus: "enabled" }
    };

    it("acusa quando exige motivo e nenhum motivo de encerramento é padrão", async () => {
      const r = await rodar("fechamento-automatico-sem-motivo-padrao", {
        ...base,
        status: [{ id: 1, name: "Venda", type: "closed", isDefault: false }]
      });
      expect(r).toHaveLength(1);
      expect(r[0]).toContain("5 h");
    });

    it("um padrão de outro tipo não resolve", async () => {
      const r = await rodar("fechamento-automatico-sem-motivo-padrao", {
        ...base,
        status: [{ id: 1, name: "Aguardando", type: "pending", isDefault: true }]
      });
      expect(r).toHaveLength(1);
    });

    it("fica quieta com um motivo de encerramento padrão", async () => {
      const r = await rodar("fechamento-automatico-sem-motivo-padrao", {
        ...base,
        status: [{ id: 1, name: "Concluído", type: "closed", isDefault: true }]
      });
      expect(r).toEqual([]);
    });

    it("fica quieta se o fechamento automático está desligado ou não exige motivo", async () => {
      expect(
        await rodar("fechamento-automatico-sem-motivo-padrao", {
          configuracoes: { autoCloseInactiveHours: "0", requireClosingStatus: "enabled" }
        })
      ).toEqual([]);
      expect(
        await rodar("fechamento-automatico-sem-motivo-padrao", {
          configuracoes: { autoCloseInactiveHours: "5", requireClosingStatus: "disabled" }
        })
      ).toEqual([]);
    });
  });

  it("motivo obrigatório exige ao menos um motivo de encerramento", async () => {
    const config = { configuracoes: { requireClosingStatus: "enabled" } };
    expect(await rodar("motivo-obrigatorio-sem-motivos", config)).toHaveLength(1);
    expect(
      await rodar("motivo-obrigatorio-sem-motivos", {
        ...config,
        status: [{ id: 1, name: "Ok", type: "closed", isDefault: false }]
      })
    ).toEqual([]);
  });

  describe("mensagem fora do horário", () => {
    const ligada = { outOfHoursMessageEnabled: "enabled", outOfHoursMessage: "Voltamos às 8h" };

    it("sem texto", async () => {
      expect(
        await rodar("fora-do-horario-sem-texto", {
          configuracoes: { outOfHoursMessageEnabled: "enabled", outOfHoursMessage: "   " }
        })
      ).toHaveLength(1);
    });

    it("sem horário: a empresa conta como sempre aberta", async () => {
      const r = await rodar("fora-do-horario-sem-horario", { configuracoes: ligada });
      expect(r[0]).toContain("sempre aberta");
    });

    it("com dia válido, tudo certo", async () => {
      expect(
        await rodar("fora-do-horario-sem-horario", {
          configuracoes: ligada,
          horarios: [{ weekDay: 1, enabled: true, startTime: "08:00", endTime: "18:00" }]
        })
      ).toEqual([]);
    });

    it("dias só com início depois do fim não contam", async () => {
      expect(
        await rodar("fora-do-horario-sem-horario", {
          configuracoes: ligada,
          horarios: [{ weekDay: 1, enabled: true, startTime: "18:00", endTime: "08:00" }]
        })
      ).toHaveLength(1);
    });
  });

  it("aponta cada dia com início depois do fim, ignorando dias fechados", async () => {
    const r = await rodar("horario-com-inicio-depois-do-fim", {
      horarios: [
        { weekDay: 1, enabled: true, startTime: "18:00", endTime: "08:00" },
        { weekDay: 2, enabled: false, startTime: "18:00", endTime: "08:00" },
        { weekDay: 3, enabled: true, startTime: "08:00:00", endTime: "12:00:00" }
      ]
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toContain("segunda");
  });

  it("distribuição automática com fila padrão sem atendente", async () => {
    const config = { configuracoes: { autoAssignTickets: "enabled" } };
    const fila = { id: 1, name: "Geral", isDefault: true, usuarios: 0, conexoes: [] };
    expect(await rodar("distribuicao-sem-atendente-na-fila-padrao", { ...config, filas: [fila] })).toHaveLength(1);
    expect(
      await rodar("distribuicao-sem-atendente-na-fila-padrao", {
        ...config,
        filas: [{ ...fila, usuarios: 2 }]
      })
    ).toEqual([]);
    // Sem fila padrão, a conversa fica sem fila e qualquer atendente online serve.
    expect(await rodar("distribuicao-sem-atendente-na-fila-padrao", config)).toEqual([]);
  });

  describe("CRM", () => {
    const quadros = [
      { id: 1, name: "Vendas", isSalesFunnel: true },
      { id: 2, name: "Produção", isSalesFunnel: false }
    ];

    it("exige um quadro de vendas quando há quadros", async () => {
      expect(
        await rodar("sem-quadro-de-vendas", { quadros: quadros.map(q => ({ ...q, isSalesFunnel: false })) })
      ).toHaveLength(1);
      expect(await rodar("sem-quadro-de-vendas", { quadros })).toEqual([]);
      expect(await rodar("sem-quadro-de-vendas", {})).toEqual([]);
    });

    it("o funil precisa de etapa de ganho ativa", async () => {
      expect(
        await rodar("funil-sem-etapa-de-ganho", {
          quadros,
          etapas: [etapa({ id: 1, boardId: 1, isWon: true, active: false })]
        })
      ).toHaveLength(1);
      expect(
        await rodar("funil-sem-etapa-de-ganho", {
          quadros,
          etapas: [etapa({ id: 1, boardId: 1, isWon: true })]
        })
      ).toEqual([]);
    });

    it("todo quadro precisa de uma saída ativa", async () => {
      const r = await rodar("quadro-sem-saida", {
        quadros,
        etapas: [etapa({ id: 1, boardId: 1, isFinal: true })]
      });
      expect(r).toHaveLength(1);
      expect(r[0]).toContain("Produção");
    });

    it("destino desativado ou quadro sem entrada", async () => {
      const r = await rodar("destino-de-etapa-invalido", {
        quadros,
        etapas: [
          etapa({ id: 1, name: "Ganho", boardId: 1, isFinal: true, targetStageId: 5 }),
          etapa({ id: 5, boardId: 2, active: false }),
          etapa({ id: 6, name: "Fim", boardId: 1, isFinal: true, targetBoardId: 2 })
        ]
      });
      expect(r).toHaveLength(2);
    });
  });

  it("PDV sem conta caixa é aviso, não bloqueio", async () => {
    const regra = REGRAS.find(r => r.id === "pdv-sem-conta-caixa");
    expect(regra?.severidade).toBe("aviso");
    expect(
      await rodar("pdv-sem-conta-caixa", { contas: [{ id: 1, name: "Banco", kind: "bank", active: true }] })
    ).toHaveLength(1);
  });

  describe("formação de preço", () => {
    it("lucro de 100% ou mais é impossível; markup alto não", async () => {
      expect(await rodar("preco-lucro-impossivel", { configuracoes: { precoModo: "lucro", precoPercentual: "100" } })).toHaveLength(1);
      expect(await rodar("preco-lucro-impossivel", { configuracoes: { precoModo: "lucro", precoPercentual: "60" } })).toHaveLength(0);
      expect(await rodar("preco-lucro-impossivel", { configuracoes: { precoModo: "markup", precoPercentual: "300" } })).toHaveLength(0);
    });

    it("produto calculado ativo precisa de insumo; inativo não conta", async () => {
      const r = await rodar("produto-calculado-sem-composicao", {
        produtos: [
          { id: 1, name: "Banner", active: true, componentes: 0, insumosInativos: [] },
          { id: 2, name: "Antigo", active: false, componentes: 0, insumosInativos: [] },
          { id: 3, name: "Adesivo", active: true, componentes: 2, insumosInativos: [] }
        ]
      });
      expect(r).toHaveLength(1);
      expect(r[0]).toContain("Banner");
    });

    it("insumo desativado em produto ativo é aviso", async () => {
      const regra = REGRAS.find(x => x.id === "produto-com-insumo-inativo");
      expect(regra?.severidade).toBe("aviso");
      const r = await rodar("produto-com-insumo-inativo", {
        produtos: [{ id: 1, name: "Banner", active: true, componentes: 2, insumosInativos: ["Lona 280g"] }]
      });
      expect(r[0]).toContain("Lona 280g");
    });
  });
});
