/**
 * Categorias de tarefa que podem ser anexadas a um negócio.
 *
 * A tarefa já existia, mas era sempre a mesma coisa: um texto com prazo. Sem
 * categoria não dá para saber, olhando a lista, se o que está atrasado é uma
 * ligação de retorno ou a impressão de um pedido -- e são urgências diferentes,
 * de pessoas diferentes.
 *
 * A lista vive no backend porque é ele quem recusa valor inválido; o frontend
 * lê daqui para montar o seletor, e assim os dois nunca divergem.
 */
export const TIPOS_DE_TAREFA = [
  { id: "contato", label: "Contato com cliente", cor: "#2f6fb0" },
  { id: "orcamento", label: "Orçamento", cor: "#7a5bd0" },
  { id: "arte", label: "Arte e aprovação", cor: "#c2568f" },
  { id: "producao", label: "Produção", cor: "#96690a" },
  { id: "compra", label: "Compra de material", cor: "#0e7a70" },
  { id: "entrega", label: "Entrega ou retirada", cor: "#1a7a55" },
  { id: "financeiro", label: "Financeiro", cor: "#b23b30" },
  { id: "outro", label: "Outro", cor: "#5c6675" }
] as const;

export const IDS_TIPOS_DE_TAREFA: readonly string[] = TIPOS_DE_TAREFA.map(t => t.id);

export const ehTipoDeTarefaValido = (valor: unknown): boolean =>
  typeof valor === "string" && IDS_TIPOS_DE_TAREFA.includes(valor);

export default TIPOS_DE_TAREFA;
