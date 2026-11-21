/**
 * Cálculo de um item de orçamento de comunicação visual.
 *
 * Concentrado num lugar só porque a mesma conta acontece em três: ao gravar o
 * item, ao somar o orçamento e ao imprimir a ordem de serviço. Espalhada, ela
 * divergiria -- e divergência aqui é o cliente recebendo um valor no papel e
 * outro na tela.
 */

export type ModoDeCobranca = "unit" | "area" | "linear";

/**
 * Acabamento escolhido no item, como foi gravado: uma fotografia do catálogo
 * no dia (nome, base, preço e custo), para o orçamento não mudar sozinho
 * quando o catálogo mudar.
 */
export interface AcabamentoDoItem {
  finishId?: number | null;
  name: string;
  /** area | perimetro | linear | unidade | fixo */
  base: string;
  price?: number | string | null;
  minPrice?: number | string | null;
  cost?: number | string | null;
  minCost?: number | string | null;
}

export interface AcabamentoCalculado {
  name: string;
  base: string;
  /** Quanto da base foi cobrado no item todo (m², metros, peças). */
  quantidade: number;
  total: number;
  custo: number;
}

export interface EntradaCalculo {
  quantity?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  unitPrice?: number | string | null;
  discount?: number | string | null;
  pricingMode?: string | null;
  /** Mínimo cobrado por peça, na unidade do modo. Zero = sem mínimo. */
  minMeasure?: number | string | null;
  /** Custo de uma unidade de medida do material. Nulo = desconhecido. */
  unitCost?: number | string | null;
  finishes?: AcabamentoDoItem[] | null;
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
  /** Material: medida (ou peças) × preço, antes dos acabamentos. */
  materiais: number;
  acabamentos: AcabamentoCalculado[];
  total: number;
  /** Custo da linha; nulo quando o custo do material é desconhecido. */
  custo: number | null;
  /** (total − custo) ÷ total, em %. Nulo sem custo ou com total zero. */
  margem: number | null;
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

  const materiais = arredondar(modo === "unit" ? pecas * preco : medidaTotal * preco);

  /**
   * Acabamentos. A base é medida na peça real -- o mínimo do material não
   * aumenta a bainha de ninguém -- e o mínimo do acabamento vale para a linha
   * inteira: é o que custa parar a máquina para fazê-lo.
   */
  const porPeca = (base: string): number => {
    if (base === "area") return largura * altura;
    if (base === "perimetro") return 2 * (largura + altura);
    if (base === "linear") return largura;
    return 1;
  };
  const acabamentos: AcabamentoCalculado[] = (Array.isArray(item.finishes) ? item.finishes : [])
    .filter(a => a && a.name)
    .map(a => {
      const fixo = a.base === "fixo";
      const quantidade = fixo ? 1 : arredondar(porPeca(a.base) * pecas, 3);
      const cobrar = (unitario: unknown, piso: unknown) =>
        fixo ? numero(unitario) : Math.max(numero(piso), quantidade * numero(unitario));
      return {
        name: a.name,
        base: a.base,
        quantidade,
        total: arredondar(cobrar(a.price, a.minPrice)),
        custo: arredondar(cobrar(a.cost, a.minCost))
      };
    });
  const somaAcabamentos = acabamentos.reduce((s, a) => s + a.total, 0);

  // Nunca negativo: um desconto maior que o item zeraria a linha, e um total
  // negativo entraria somando ao contrário no orçamento.
  const total = arredondar(Math.max(0, materiais + somaAcabamentos - desconto));

  /**
   * Custo. O material consome a medida real (a perda já está no custo do
   * insumo); o mínimo cobrado do cliente não é consumo. Sem custo do material
   * não há custo da linha: somar só os acabamentos daria uma margem falsa.
   */
  const temCusto = item.unitCost !== null && item.unitCost !== undefined && item.unitCost !== "";
  const consumo = modo === "unit" ? pecas : medidaUnitaria * pecas;
  const custo = temCusto
    ? arredondar(consumo * numero(item.unitCost) + acabamentos.reduce((s, a) => s + a.custo, 0))
    : null;
  const margem =
    custo === null || total <= 0 ? null : arredondar(((total - custo) / total) * 100, 1);

  return {
    medidaUnitaria,
    medidaCobrada,
    medidaTotal,
    aplicouMinimo,
    materiais,
    acabamentos,
    total,
    custo,
    margem
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
