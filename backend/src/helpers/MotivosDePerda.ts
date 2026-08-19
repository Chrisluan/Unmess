/**
 * Motivos de perda oferecidos ao registrar um card como perdido.
 *
 * Existe uma lista pronta porque motivo digitado à mão vira relatório inútil:
 * "caro", "achou caro", "preço" e "valor alto" são a mesma coisa e contam como
 * quatro. Com a lista, dá para responder "por que perdemos" olhando um número.
 *
 * O campo livre continua valendo -- há perdas que não cabem em categoria, e
 * obrigar a escolher faria todo mundo marcar "outro" e perder a informação.
 */
export const MOTIVOS_DE_PERDA = [
  { id: "preco", label: "Preço acima do orçamento do cliente" },
  { id: "prazo", label: "Prazo de entrega não atendia" },
  { id: "concorrencia", label: "Fechou com concorrente" },
  { id: "sem_retorno", label: "Cliente parou de responder" },
  { id: "desistiu", label: "Cliente desistiu do projeto" },
  { id: "fora_escopo", label: "Fora do que atendemos" },
  { id: "duplicado", label: "Pedido duplicado ou engano" },
  { id: "outro", label: "Outro motivo" }
] as const;

export const ehMotivoConhecido = (valor: unknown): boolean =>
  typeof valor === "string" && MOTIVOS_DE_PERDA.some(m => m.id === valor);

/**
 * Texto final gravado no card.
 *
 * Quando o motivo escolhido é da lista, grava-se o rótulo por extenso: quem ler
 * o card daqui a um ano não deve precisar de um decodificador para entender
 * "sem_retorno". O complemento digitado entra junto, entre parênteses.
 */
export const descreverMotivo = (motivo?: string, detalhe?: string): string => {
  const item = MOTIVOS_DE_PERDA.find(m => m.id === motivo);
  const base = item ? item.label : (motivo || "").trim();
  const extra = (detalhe || "").trim();

  if (base && extra) return `${base} — ${extra}`;
  return base || extra;
};

export default MOTIVOS_DE_PERDA;
