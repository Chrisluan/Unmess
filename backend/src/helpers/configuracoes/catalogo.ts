import AppError from "../../errors/AppError";

/**
 * As configurações que uma empresa pode gravar, com tipo e padrão.
 *
 * Antes, `PUT /settings/:chave` aceitava qualquer chave e qualquer texto. Um
 * erro de digitação no frontend criava uma configuração fantasma que ninguém
 * lia, e um "abc" num campo de horas desligava o recurso sem aviso. Aqui fica
 * a lista fechada: o que não está nela não é gravado.
 *
 * O padrão declarado é o mesmo que o código usa quando a linha não existe --
 * mantenha os dois em sincronia ao mudar um deles.
 */

export type TipoDeConfiguracao = "booleano" | "inteiro" | "texto" | "segredo";

export interface DefinicaoDeConfiguracao {
  tipo: TipoDeConfiguracao;
  padrao: string;
  /** Limites para `inteiro`. */
  minimo?: number;
  maximo?: number;
  /** Tamanho máximo para `texto`. */
  tamanhoMaximo?: number;
}

export const CATALOGO_DE_CONFIGURACOES: Record<string, DefinicaoDeConfiguracao> = {
  // Atendimento
  autoAssignTickets: { tipo: "booleano", padrao: "disabled" },
  requireClosingStatus: { tipo: "booleano", padrao: "disabled" },
  allowAgentSeeAllTickets: { tipo: "booleano", padrao: "disabled" },
  autoCloseInactiveHours: { tipo: "inteiro", padrao: "0", minimo: 0, maximo: 8760 },
  reopenTicketWindowHours: { tipo: "inteiro", padrao: "2", minimo: 0, maximo: 8760 },

  // Experiência
  signMessages: { tipo: "booleano", padrao: "enabled" },
  notificationSound: { tipo: "booleano", padrao: "enabled" },

  // Mensagens automáticas
  transferMessageEnabled: { tipo: "booleano", padrao: "disabled" },
  transferMessage: { tipo: "texto", padrao: "", tamanhoMaximo: 4000 },
  outOfHoursMessageEnabled: { tipo: "booleano", padrao: "disabled" },
  outOfHoursMessage: { tipo: "texto", padrao: "", tamanhoMaximo: 4000 },

  // Integrações. Só o servidor gera: ver POST /settings/userApiToken/gerar.
  userApiToken: { tipo: "segredo", padrao: "" }
};

export const definicaoDe = (chave: string): DefinicaoDeConfiguracao => {
  const definicao = CATALOGO_DE_CONFIGURACOES[chave];
  if (!definicao) throw new AppError("ERR_CONFIGURACAO_DESCONHECIDA", 400);
  return definicao;
};

/**
 * Normaliza e valida o valor que chegou da tela.
 *
 * Booleanos aceitam também true/false (o que outras telas costumavam mandar)
 * mas são gravados sempre como "enabled"/"disabled": com dois formatos no
 * banco, um leitor que só conhece um deles via o recurso desligado.
 */
export const normalizarValor = (chave: string, valor: unknown): string => {
  const definicao = definicaoDe(chave);

  switch (definicao.tipo) {
    case "booleano": {
      if (valor === true || valor === "true" || valor === "enabled") return "enabled";
      if (valor === false || valor === "false" || valor === "disabled") return "disabled";
      throw new AppError("ERR_CONFIGURACAO_VALOR_INVALIDO", 400);
    }
    case "inteiro": {
      const texto = String(valor ?? "").trim();
      const numero = texto === "" ? Number(definicao.padrao) : Number(texto);
      if (
        !Number.isInteger(numero) ||
        (definicao.minimo !== undefined && numero < definicao.minimo) ||
        (definicao.maximo !== undefined && numero > definicao.maximo)
      ) {
        throw new AppError("ERR_CONFIGURACAO_VALOR_INVALIDO", 400);
      }
      return String(numero);
    }
    case "texto": {
      const texto = valor === null || valor === undefined ? "" : String(valor);
      if (definicao.tamanhoMaximo && texto.length > definicao.tamanhoMaximo) {
        throw new AppError("ERR_CONFIGURACAO_VALOR_INVALIDO", 400);
      }
      return texto;
    }
    case "segredo":
    default:
      // Segredo não se grava pela rota genérica: quem escolhe o valor é o
      // servidor, não a tela.
      throw new AppError("ERR_CONFIGURACAO_SOMENTE_SERVIDOR", 400);
  }
};
