/**
 * Conta de uma linha de orçamento, do lado da tela.
 *
 * A conta que vale é a do servidor (backend/src/helpers/CalcularItem); esta
 * existe só para a linha somar enquanto se digita. Por isso é uma tradução
 * fiel -- se as duas divergirem, o total muda ao salvar e ninguém entende por
 * quê.
 *
 * Ficou fora da aba de itens porque agora três telas fazem a mesma pergunta:
 * a linha, o cartão do celular e a prévia do catálogo ao escolher o produto.
 */

export const MODOS_DE_COBRANCA = [
  { valor: "unit", rotulo: "Unidade", curto: "un" },
  { valor: "area", rotulo: "Metro quadrado", curto: "m²" },
  { valor: "linear", rotulo: "Metro linear", curto: "m" }
];

export const rotuloDoModo = (modo) =>
  MODOS_DE_COBRANCA.find((m) => m.valor === modo)?.rotulo || "Unidade";

export const moeda = (valor) =>
  valor === null || valor === undefined
    ? "—"
    : Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

/**
 * Devolve a medida cobrada, o total da linha e se o mínimo entrou em ação.
 *
 * O mínimo vale por peça: dez adesivos pequenos custam dez mínimos.
 */
export const calcularLinha = (item) => {
  const modo = item.pricingMode || "unit";
  const pecas = Number(item.quantity) || 0;
  const preco = Number(item.unitPrice) || 0;
  const desconto = Number(item.discount) || 0;
  const minimo = Number(item.minMeasure) || 0;
  const largura = Number(item.width) || 0;
  const altura = Number(item.height) || 0;

  let medida;
  if (modo === "area") medida = largura * altura;
  else if (modo === "linear") medida = largura;
  else medida = 1;

  const aplicouMinimo =
    modo !== "unit" && minimo > 0 && medida > 0 && medida < minimo;
  const cobrada = aplicouMinimo ? minimo : medida;
  const arred = (n, casas = 2) => Number(Number(n).toFixed(casas));
  const medidaTotal = arred(Number(cobrada.toFixed(3)) * pecas, 3);
  const materiais = arred(modo === "unit" ? pecas * preco : medidaTotal * preco);

  // Acabamentos: base medida na peça real; mínimo vale para a linha toda;
  // "fixo" cobra uma vez por item. Igual a CalcularItem no servidor.
  const porPeca = (base) => {
    if (base === "area") return largura * altura;
    if (base === "perimetro") return 2 * (largura + altura);
    if (base === "linear") return largura;
    return 1;
  };
  const acabamentos = (Array.isArray(item.finishes) ? item.finishes : [])
    .filter((a) => a && a.name)
    .map((a) => {
      const fixo = a.base === "fixo";
      const quantidade = fixo ? 1 : arred(porPeca(a.base) * pecas, 3);
      const cobrar = (unitario, piso) =>
        fixo
          ? Number(unitario) || 0
          : Math.max(Number(piso) || 0, quantidade * (Number(unitario) || 0));
      return {
        name: a.name,
        base: a.base,
        quantidade,
        total: arred(cobrar(a.price, a.minPrice)),
        custo:
          a.cost === null || a.cost === undefined ? null : arred(cobrar(a.cost, a.minCost)),
      };
    });
  const somaAcabamentos = acabamentos.reduce((s, a) => s + a.total, 0);
  const total = arred(Math.max(0, materiais + somaAcabamentos - desconto));

  // Custo só existe quando o servidor mandou (quem não pode ver recebe null).
  const temCusto =
    item.unitCost !== null && item.unitCost !== undefined && item.unitCost !== "";
  const consumo = modo === "unit" ? pecas : arred(medida, 3) * pecas;
  const custo = temCusto
    ? arred(
        consumo * (Number(item.unitCost) || 0) +
          acabamentos.reduce((s, a) => s + (a.custo || 0), 0)
      )
    : null;
  const margem =
    custo === null || total <= 0 ? null : arred(((total - custo) / total) * 100, 1);

  return {
    medida: Number(medida.toFixed(3)),
    cobrada: Number(cobrada.toFixed(3)),
    materiais,
    acabamentos,
    total,
    custo,
    margem,
    aplicouMinimo
  };
};

/** Como a base de um acabamento se lê. */
export const BASES_DE_ACABAMENTO = [
  { valor: "area", rotulo: "Por m²", curto: "m²" },
  { valor: "perimetro", rotulo: "Por metro de contorno", curto: "m contorno" },
  { valor: "linear", rotulo: "Por metro linear", curto: "m" },
  { valor: "unidade", rotulo: "Por peça", curto: "un" },
  { valor: "fixo", rotulo: "Valor fixo no item", curto: "fixo" }
];

export const rotuloDaBase = (base) =>
  BASES_DE_ACABAMENTO.find((b) => b.valor === base)?.rotulo || base;

/**
 * Acabamento do catálogo como ele entra no item: id, nome, base e o preço do
 * dia. O custo vai junto só para a margem na tela; o servidor ignora o que a
 * tela manda e copia o custo do catálogo.
 */
export const acabamentoDoCatalogo = (acabamento) => ({
  finishId: acabamento.id,
  name: acabamento.name,
  base: acabamento.base,
  price: Number(acabamento.price) || 0,
  minPrice: Number(acabamento.minPrice) || 0,
  cost: acabamento.cost === null || acabamento.cost === undefined ? null : Number(acabamento.cost),
  minCost:
    acabamento.minCost === null || acabamento.minCost === undefined ? null : Number(acabamento.minCost)
});

export const totalDaLinha = (item) => calcularLinha(item).total;

/**
 * Como a medida da linha se lê em uma frase curta.
 *
 * Aparece embaixo dos campos de medida, onde a pergunta é sempre "então vai
 * cobrar quanto de quê" -- e a resposta some se ficar só o número.
 */
export const descricaoDaMedida = (item) => {
  const modo = item.pricingMode || "unit";
  if (modo === "unit") return "";

  const { medida, cobrada, aplicouMinimo } = calcularLinha(item);
  const unidade = modo === "area" ? "m²" : "m";
  const numero = (n) => n.toLocaleString("pt-BR");

  if (aplicouMinimo) {
    return `${numero(medida)} ${unidade} por peça — cobrando o mínimo de ${numero(
      cobrada
    )} ${unidade}`;
  }

  return `${numero(medida)} ${unidade} por peça`;
};

/** Linha nova, em branco. */
export const itemVazio = () => ({
  description: "",
  quantity: 1,
  unit: "un",
  unitPrice: 0,
  discount: 0,
  pricingMode: "unit",
  minMeasure: 0,
  width: 0,
  height: 0,
  notes: "",
  productId: null,
  unitCost: null,
  finishes: []
});

/**
 * Linha montada a partir de um produto do catálogo.
 *
 * O preço é copiado, e não referenciado: o que o cliente aprova é o valor
 * daquele dia, e um reajuste no catálogo não pode reescrever orçamento já
 * fechado. O productId fica guardado só para saber o que foi vendido.
 */
export const itemDeProduto = (produto, quantidade = 1) => ({
  ...itemVazio(),
  productId: produto.id,
  description: produto.name,
  unit: produto.unit || "un",
  unitPrice: produto.price,
  pricingMode: produto.pricingMode || "unit",
  minMeasure: produto.minMeasure || 0,
  quantity: quantidade,
  // Só para a margem aparecer enquanto se monta; quem grava o custo é o
  // servidor. Para quem não vê custo, chega null e a margem não aparece.
  unitCost: produto.cost === undefined ? null : produto.cost,
  // Os acabamentos marcados como padrão no produto já entram escolhidos.
  finishes: (produto.acabamentos || [])
    .filter((pa) => pa.isDefault && pa.finish && pa.finish.active !== false)
    .map((pa) => acabamentoDoCatalogo(pa.finish))
});
