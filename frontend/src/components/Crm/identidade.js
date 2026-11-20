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

  /**
   * Orçamento continua orçamento depois de gerar o pedido.
   *
   * O pedido é outro documento, com número próprio; o card do funil é o
   * orçamento que o originou e é assim que aparece, com o pedido indicado ao
   * lado (`pedidoGerado`). Card de funil com número de produção é anterior a
   * esta regra e segue como era.
   */
  const ativo = (p) => (p && !p.canceledAt ? p : null);
  const pedidoGerado = ativo(deal?.pedido) || ativo(pedido);
  const noFunilDeVendas =
    opcoes.noFunil !== undefined ? opcoes.noFunil : deal?.board?.isSalesFunnel;
  if (
    deal?.papel === "orcamento" ||
    deal?.papel === "orcamento_aprovado" ||
    (noFunilDeVendas === true && !deal?.orderNumber)
  ) {
    return {
      tipo: "orcamento",
      rotulo: "Orçamento",
      numero: deal?.quoteNumber || deal?.id,
      orcamentoDeOrigem: null,
      pedidoGerado: pedidoGerado?.number || null,
    };
  }

  /**
   * O número da ordem de produção, na contagem da própria empresa.
   *
   * Vem do card, e não do registro em Orders, porque a jornada troca de linha
   * a cada quadro: o registro aponta para o card que saiu do funil, e o mesmo
   * trabalho segue por Produção e Expedição com outros ids. Orders continua
   * valendo como reserva para o que foi gravado antes desta coluna existir.
   */
  const numeroDeProducao = deal?.orderNumber || pedido?.number || null;

  if (numeroDeProducao) {
    return {
      tipo: "pedido",
      rotulo: "Pedido",
      numero: numeroDeProducao,
      // De qual orçamento este trabalho nasceu, quando houve um. O card
      // carrega o número do orçamento por todos os quadros; o registro de
      // pedido responde pelo que veio de antes.
      orcamentoDeOrigem: pedido?.quoteNumber || deal?.quoteNumber || null,
    };
  }

  const noFunil =
    opcoes.noFunil !== undefined ? opcoes.noFunil : deal?.board?.isSalesFunnel;

  /**
   * Fora do funil e sem número de produção: é trabalho anterior à numeração
   * própria. Continua sendo pedido -- chamá-lo de orçamento seria mentir sobre
   * o que já foi vendido --, e o número que resta é o que ele sempre teve.
   *
   * O `deal.id` no fim da fila é o id da linha no banco, comum a todas as
   * empresas. Não é número de nada para quem atende, e é justamente o que a
   * migração da contagem por empresa veio substituir: se ainda aparecer, é
   * porque aquele card ficou de fora dela.
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

/**
 * De quem é o card, para a tela mostrar sem precisar abrir.
 *
 * A ordem não é arbitrária: o nome fantasia é como a empresa é chamada no
 * dia a dia, a razão social é o que consta no cadastro, e o contato do
 * WhatsApp é o que resta quando ainda não houve cadastro nenhum — o caso mais
 * comum de um card recém-nascido dentro da conversa.
 *
 * Contato sem nome salvo tem o próprio número no lugar do nome. Repeti-lo em
 * duas linhas do card não ajuda ninguém, então nesse caso ele aparece uma vez
 * só, formatado.
 */
export const clienteDoNegocio = (deal) => {
  const soDigitos = (valor) => String(valor || "").replace(/\D/g, "");

  const nome =
    deal?.customer?.tradeName?.trim() ||
    deal?.customer?.name?.trim() ||
    deal?.contact?.name?.trim() ||
    "";

  const telefone = deal?.contact?.number || "";
  const nomeEhONumero =
    Boolean(nome) && Boolean(telefone) && soDigitos(nome) === soDigitos(telefone);

  return {
    nome: nomeEhONumero ? "" : nome,
    telefone,
    // O contato do WhatsApp responde "quem é" com a foto, que é o que o
    // atendente reconhece antes de ler qualquer coisa.
    fotoUrl: deal?.contact?.profilePicUrl || "",
    // Verdadeiro quando não há nem cadastro nem contato: o card não tem como
    // se identificar, e é isso que a tela precisa dizer.
    semCliente: !nome && !telefone,
  };
};

/** "Pedido nº 45" — o rótulo pronto, que é como quase toda tela usa. */
export const descreverNegocio = (deal, opcoes = {}) => {
  const { rotulo, numero } = identidadeDoNegocio(deal, opcoes);
  return `${rotulo} nº ${numero}`;
};

export default identidadeDoNegocio;
