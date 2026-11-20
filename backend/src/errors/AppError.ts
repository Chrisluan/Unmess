/**
 * Erro de regra de negócio, com o status HTTP que a API deve devolver.
 *
 * Herda de Error para levar mensagem e pilha consigo. Antes era uma classe
 * solta: `${erro}` virava "[object Object]" e todo log que interpolava o erro
 * perdia justamente o que explicava a falha.
 */
class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

export default AppError;
