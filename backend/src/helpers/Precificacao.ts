import { Transaction } from "sequelize";
import GetSetting, { GetSettingNumber } from "./GetSetting";

/**
 * Formação de preço a partir do custo.
 *
 * Duas convenções convivem no mercado, e a empresa escolhe a sua:
 * - markup: preço = custo × (1 + p%). 100% de markup dobra o custo.
 * - lucro (margem sobre a venda): preço = custo ÷ (1 − p%). 50% de lucro
 *   também dobra o custo -- metade do preço fica para a empresa.
 * A confusão entre as duas é a origem clássica de preço errado; por isso o
 * nome do modo aparece em toda tela que mostra o percentual.
 */

export type ModoDePreco = "markup" | "lucro";

export interface RegraDePreco {
  modo: ModoDePreco;
  percentual: number;
}

const arredondar = (valor: number, casas = 2) => Number(valor.toFixed(casas));

/**
 * Preço para um custo. Devolve null quando a regra é impossível (lucro de
 * 100% ou mais dividiria por zero ou daria preço negativo): quem chama mantém
 * o preço anterior, e a regra de consistência "preco-lucro-impossivel" é quem
 * explica o problema.
 */
export const precoPeloCusto = (
  custo: number,
  { modo, percentual }: RegraDePreco,
  casas = 2
): number | null => {
  const c = Math.max(0, Number(custo) || 0);
  const p = Math.max(0, Number(percentual) || 0);
  if (modo === "lucro") {
    if (p >= 100) return null;
    return arredondar(c / (1 - p / 100), casas);
  }
  return arredondar(c * (1 + p / 100), casas);
};

export interface LinhaDeComposicao {
  quantity: number;
  supply?: { cost: number; wastePercent: number } | null;
}

/** Custo de uma unidade de medida do produto: Σ consumo × custo × (1 + perda). */
export const custoDaComposicao = (linhas: LinhaDeComposicao[]): number =>
  arredondar(
    linhas.reduce((soma, linha) => {
      if (!linha.supply) return soma;
      const perda = 1 + (Number(linha.supply.wastePercent) || 0) / 100;
      return soma + (Number(linha.quantity) || 0) * (Number(linha.supply.cost) || 0) * perda;
    }, 0),
    4
  );

/** A regra da empresa, com o percentual próprio do produto quando houver. */
export const regraDaEmpresa = async (
  companyId: number,
  transaction?: Transaction
): Promise<RegraDePreco> => {
  const modo = await GetSetting("precoModo", companyId, "markup", transaction);
  const percentual = await GetSettingNumber("precoPercentual", companyId, 100, transaction);
  return { modo: modo === "lucro" ? "lucro" : "markup", percentual };
};
