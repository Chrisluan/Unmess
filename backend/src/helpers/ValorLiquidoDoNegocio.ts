interface NegocioComDesconto {
  value: number;
  discount: number;
  /** value | percent */
  discountType: string;
}

/**
 * Quanto o cliente paga por este negócio.
 *
 * `value` é a soma dos itens, bruta; o desconto incide sobre ela. A conta
 * existia só na tela da proposta, e a ordem de serviço imprimia o bruto --
 * dois documentos do mesmo pedido com números diferentes. Agora é uma conta
 * só, e quem fatura e quem imprime leem daqui.
 */
export const valorLiquidoDoNegocio = (deal: NegocioComDesconto): number => {
  const bruto = Number(deal?.value || 0);

  const abatimento =
    deal?.discountType === "percent"
      ? (bruto * Number(deal?.discount || 0)) / 100
      : Number(deal?.discount || 0);

  // Desconto maior que o pedido não vira crédito a favor do cliente.
  return Math.max(0, Number((bruto - abatimento).toFixed(2)));
};

export default valorLiquidoDoNegocio;
