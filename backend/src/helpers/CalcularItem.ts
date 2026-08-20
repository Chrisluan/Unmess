/**
 * Cálculo de um item de orçamento de comunicação visual.
 *
 * Concentrado num lugar só porque a mesma conta acontece em três: ao gravar o
 * item, ao somar o orçamento e ao imprimir a ordem de serviço. Espalhada, ela
 * divergiria -- e divergência aqui é o cliente recebendo um valor no papel e
 * outro na tela.
 */

export type ModoDeCobranca = "unit" | "area" | "linear";

export interface EntradaCalculo {
  quantity?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  unitPrice?: number | string | null;
  discount?: number | string | null;
  pricingMode?: string | null;
  /** Mínimo cobrado por peça, na unidade do modo. Zero = sem mínimo. */
  minMeasure?: number | string | null;
}

export interface ResultadoCalculo {
  /** Medida de uma peça: m² no modo área, metros no linear, 1 na unidade. */
  medidaUnitaria: number;
  /** O que será cobrado por peça, já respeitando o mínimo. */
  medidaCobrada: number;
  /** Medida cobrada x peças. */
  medidaTotal: number;
  /** Verdadeiro quando o mínimo entrou no lugar da medida real. */
  aplicouMinimo: boolean;
  total: number;
}

const numero = (valor: unknown, padrao = 0): number => {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : padrao;
};

const arredondar = (valor: number, casas = 2): number =>
  Number(valor.toFixed(casas));

export const calcularItem = (item: EntradaCalculo): ResultadoCalculo => {
  const modo = (item.pricingMode || "unit") as ModoDeCobranca;
  const pecas = numero(item.quantity, 1);
  const preco = numero(item.unitPrice);
  const desconto = numero(item.discount);
  const minimo = numero(item.minMeasure);

  const largura = numero(item.width);
  const altura = numero(item.height);

  /**
   * A medida de uma peça, conforme o modo.
   *
   * No linear usa-se a largura como comprimento: é o campo que a pessoa
   * preenche ao orçar uma faixa de 8 metros, e pedir "altura" ali só
   * confundiria.
   */
  let medidaUnitaria: number;
  if (modo === "area") medidaUnitaria = arredondar(largura * altura, 3);
  else if (modo === "linear") medidaUnitaria = arredondar(largura, 3);
  else medidaUnitaria = 1;

  // O mínimo vale por peça, e não pelo pedido: dez adesivos pequenos custam
  // dez mínimos, porque cada um dá o mesmo trabalho de preparar e refilar.
  const aplicouMinimo =
    modo !== "unit" && minimo > 0 && medidaUnitaria > 0 && medidaUnitaria < minimo;

  const medidaCobrada = aplicouMinimo ? minimo : medidaUnitaria;
  const medidaTotal = arredondar(medidaCobrada * pecas, 3);

  const bruto = modo === "unit" ? pecas * preco : medidaTotal * preco;

  return {
    medidaUnitaria,
    medidaCobrada,
    medidaTotal,
    aplicouMinimo,
    // Nunca negativo: um desconto maior que o item zeraria a linha, e um total
    // negativo entraria somando ao contrário no orçamento.
    total: arredondar(Math.max(0, bruto - desconto))
  };
};

/** Como a medida é escrita na tela e no papel. */
export const descreverMedida = (item: EntradaCalculo): string => {
  const modo = (item.pricingMode || "unit") as ModoDeCobranca;
  const { medidaUnitaria, medidaCobrada, aplicouMinimo } = calcularItem(item);

  // O minimo aparece junto: sem isso a ordem de servico mostraria um adesivo
  // de 0,01 m2 custando 80 reais, e a oficina leria aquilo como erro.
  const minimo = aplicouMinimo
    ? ` (min. ${medidaCobrada.toLocaleString("pt-BR")} ${modo === "area" ? "m²" : "m"})`
    : "";

  if (modo === "area") {
    const l = numero(item.width);
    const a = numero(item.height);
    if (!l || !a) return "";
    return `${l.toLocaleString("pt-BR")} × ${a.toLocaleString("pt-BR")} m = ${medidaUnitaria.toLocaleString(
      "pt-BR"
    )} m²${minimo}`;
  }

  if (modo === "linear") {
    if (!medidaUnitaria) return "";
    return `${medidaUnitaria.toLocaleString("pt-BR")} m${minimo}`;
  }

  return "";
};

export default calcularItem;
