/**
 * As mesmas regras de dependência que o servidor aplica, para a tela poder
 * mostrar o resultado antes de salvar.
 *
 * A lógica é a mesma, mas os dados não são duplicados: o `requer` de cada
 * ação vem do catálogo servido pela API. Marcar "excluir conversa" acende
 * "ver conversas" na hora, e desmarcar "ver conversas" apaga tudo que
 * dependia dela — o que a pessoa vê na tela é o que vai ser gravado.
 */

const NIVEIS = ["ver", "operar", "gerenciar"];

/** Acrescenta, recursivamente, tudo que as permissões escolhidas exigem. */
export const comDependencias = (ids, indice) => {
  const resultado = new Set();

  const incluir = (id, visitados) => {
    if (visitados.has(id) || !indice.has(id)) return;
    visitados.add(id);
    resultado.add(id);
    (indice.get(id).acao.requer ?? []).forEach((dep) => incluir(dep, visitados));
  };

  ids.forEach((id) => incluir(id, new Set()));
  return Array.from(resultado);
};

/** Tira uma permissão e, junto, tudo que dependia dela. */
export const semDependentes = (ids, removida, indice) => {
  const restantes = new Set(ids.filter((id) => id !== removida));
  let mudou = true;

  while (mudou) {
    mudou = false;
    restantes.forEach((id) => {
      const requer = indice.get(id)?.acao.requer ?? [];
      if (requer.some((dep) => !restantes.has(dep))) {
        restantes.delete(id);
        mudou = true;
      }
    });
  }

  return Array.from(restantes);
};

/** As permissões de um módulo até determinado nível, inclusive. */
export const permissoesDoNivel = (modulo, nivel, indice) => {
  const limite = NIVEIS.indexOf(nivel);
  if (limite < 0) return [];

  const ids = Object.entries(modulo.acoes)
    .filter(([, acao]) => NIVEIS.indexOf(acao.nivel) <= limite)
    .map(([acaoChave]) => `${modulo.chave}:${acaoChave}`);

  return comDependencias(ids, indice);
};

/**
 * Que nível o conjunto atual representa para este módulo.
 *
 * Devolve "nenhum", um dos três níveis, ou "personalizado" quando o conjunto
 * não bate exatamente com nenhum deles. O seletor rápido mostra o nível; o
 * ajuste fino, as caixas. Fingir que um conjunto irregular é um nível redondo
 * faria o seletor mentir na primeira vez que alguém abrisse a tela.
 */
export const nivelDoModulo = (modulo, selecionadas, indice) => {
  const doModulo = Object.keys(modulo.acoes).map(
    (acao) => `${modulo.chave}:${acao}`
  );
  const ativas = doModulo.filter((id) => selecionadas.includes(id));

  if (ativas.length === 0) return "nenhum";

  const nivelBate = NIVEIS.find((nivel) => {
    const esperadas = permissoesDoNivel(modulo, nivel, indice).filter((id) =>
      doModulo.includes(id)
    );
    return (
      esperadas.length === ativas.length &&
      esperadas.every((id) => ativas.includes(id))
    );
  });

  return nivelBate ?? "personalizado";
};

/**
 * Lê as exceções gravadas no usuário, que chegam como texto nas listagens.
 *
 * JSON estragado vira "nenhuma exceção", nunca um erro de tela: a listagem
 * inteira não pode quebrar por causa de uma linha esquisita no banco.
 */
export const lerExcecoes = (cru) => {
  if (!cru) return { allow: [], deny: [] };
  try {
    const bruto = typeof cru === "string" ? JSON.parse(cru) : cru;
    return {
      allow: bruto?.allow ?? [],
      deny: bruto?.deny ?? [],
    };
  } catch {
    return { allow: [], deny: [] };
  }
};

export const ROTULO_DO_NIVEL = {
  nenhum: "Sem acesso",
  ver: "Somente ver",
  operar: "Ver e operar",
  gerenciar: "Controle total",
  personalizado: "Personalizado",
};

export default {
  comDependencias,
  semDependentes,
  permissoesDoNivel,
  nivelDoModulo,
  ROTULO_DO_NIVEL,
};
