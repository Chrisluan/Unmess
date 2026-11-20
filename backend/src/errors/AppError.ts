/**
 * Erro de regra de negócio, com o status HTTP que a API deve devolver.
 *
 * Herda de Error para levar mensagem e pilha consigo. Antes era uma classe
 * solta: `${erro}` virava "[object Object]" e todo log que interpolava o erro
 * perdia justamente o que explicava a falha.
 *
 * `detalhes` vai junto na resposta, para erros que a tela precisa explicar
 * (por exemplo, a lista do que falta numa configuração inconsistente).
 */
class AppError extends Error {
  public readonly statusCode: number;

  public readonly detalhes?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 400,
    detalhes?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.detalhes = detalhes;
  }
}

export default AppError;
