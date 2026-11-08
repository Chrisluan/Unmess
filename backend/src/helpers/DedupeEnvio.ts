/**
 * Guarda o resultado dos envios recentes por chave de cliente.
 *
 * Serve ao "tentar novamente" da tela: quando a mensagem sai de fato mas a
 * resposta se perde no caminho — rede oscilando, aba recarregada, tempo
 * esgotado —, o atendente vê uma falha e reenvia. Sem esta memória, o contato
 * recebia a mesma mensagem duas vezes.
 *
 * A chave é gerada pelo navegador e repetida a cada tentativa da mesma
 * mensagem, então a segunda chamada devolve o resultado da primeira em vez de
 * mandar de novo. Fica só em memória e por poucos minutos: é uma proteção
 * contra o clique repetido, não um registro.
 */

interface Registro<T> {
  promessa: Promise<T>;
  criadoEm: number;
}

const VALIDADE_MS = 5 * 60 * 1000;
const LIMITE = 5000;

const registros = new Map<string, Registro<any>>();

const limpar = (): void => {
  const limite = Date.now() - VALIDADE_MS;

  registros.forEach((registro, chave) => {
    if (registro.criadoEm < limite) registros.delete(chave);
  });

  // Rede muito movimentada com o cliente mandando chaves novas o tempo todo:
  // descarta as mais antigas para o mapa não crescer sem limite.
  if (registros.size > LIMITE) {
    const excedente = registros.size - LIMITE;
    const chaves = Array.from(registros.keys()).slice(0, excedente);
    chaves.forEach(chave => registros.delete(chave));
  }
};

/**
 * Executa `acao` uma única vez por chave. Chamadas repetidas com a mesma
 * chave — inclusive enquanto a primeira ainda está em andamento — esperam e
 * recebem o mesmo resultado.
 *
 * Sem chave (o cliente não mandou nenhuma) executa direto, como antes.
 */
export const envioUnico = async <T>(
  chave: string | undefined,
  acao: () => Promise<T>
): Promise<T> => {
  if (!chave) return acao();

  limpar();

  const anterior = registros.get(chave);
  if (anterior) return anterior.promessa;

  const promessa = acao();
  registros.set(chave, { promessa, criadoEm: Date.now() });

  try {
    return await promessa;
  } catch (err) {
    // Falhou de verdade: a próxima tentativa precisa mesmo tentar de novo.
    registros.delete(chave);
    throw err;
  }
};

export default envioUnico;
