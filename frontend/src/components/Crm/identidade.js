/**
 * Orçamento ou pedido — e com que número.
 *
 * São coisas diferentes, em tabelas diferentes, com contadores independentes.
 * Enquanto o card está no quadro marcado como funil de vendas ele é um
 * **orçamento**, identificado por `quoteNumber`. Ao sair do funil o trabalho
 * vira **pedido**, com numeração própria da empresa, guardada em Orders e
 * exposta aqui como `salesOrder`.
 *
 * A tela chamava tudo de "Orçamento" e mostrava `deal.id` -- o id da linha no
 * banco, que não é número de nada para quem atende. Um pedido em produção
 * aparecia como orçamento, com um número que o cliente nunca ouviu.
 */

/**
 * @param deal    negócio, como vem da API
 * @param opcoes  `noFunil` responde se o card está no funil quando o quadro não
 *                veio junto na carga (o Kanban conhece o quadro ativo, o card não)
 */
export const identidadeDoNegocio = (deal, opcoes = {}) => {
  const pedido = deal?.salesOrder;

  // O registro de pedido é a prova de que o card saiu do funil: ele só nasce
  // nessa passagem.
  if (pedido?.number) {
    return {
      tipo: "pedido",
      rotulo: "Pedido",
      numero: pedido.number,
      // De qual orçamento este pedido nasceu, quando houve um.
      orcamentoDeOrigem: pedido.quoteNumber || null,
    };
  }

  const noFunil =
    opcoes.noFunil !== undefined ? opcoes.noFunil : deal?.board?.isSalesFunnel;

  /**
   * Fora do funil e sem registro de pedido: é trabalho anterior à numeração
   * própria. Continua sendo pedido -- chamá-lo de orçamento seria mentir sobre
   * o que já foi vendido --, e o número que resta é o que ele sempre teve.
   */
  if (noFunil === false) {
    return {
      tipo: "pedido",
      rotulo: "Pedido",
      numero: deal?.quoteNumber || deal?.id,
      orcamentoDeOrigem: null,
    };
  }

  return {
    tipo: "orcamento",
    rotulo: "Orçamento",
    numero: deal?.quoteNumber || deal?.id,
    orcamentoDeOrigem: null,
  };
};

/** "Pedido nº 45" — o rótulo pronto, que é como quase toda tela usa. */
export const descreverNegocio = (deal, opcoes = {}) => {
  const { rotulo, numero } = identidadeDoNegocio(deal, opcoes);
  return `${rotulo} nº ${numero}`;
};

export default identidadeDoNegocio;
