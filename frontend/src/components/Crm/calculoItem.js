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
  Number(valor || 0).toLocaleString("pt-BR", {
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
  const bruto = modo === "unit" ? pecas * preco : cobrada * pecas * preco;

  return {
    medida: Number(medida.toFixed(3)),
    cobrada: Number(cobrada.toFixed(3)),
    total: Math.max(0, bruto - desconto),
    aplicouMinimo
  };
};

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
  productId: null
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
  quantity: quantidade
});
