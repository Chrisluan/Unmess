/**
 * Quadros e colunas com que toda empresa nova nasce.
 *
 * Existe porque um CRM sem quadro nem coluna não deixa criar o primeiro card —
 * a empresa precisa chegar com um fluxo utilizável e ajustar depois.
 *
 * A ordem dos quadros é o caminho que o card percorre. Financeiro fica por
 * último porque é a coluna final do último quadro que marca a venda como
 * faturada, e faturar depois de entregar é o fluxo normal da operação.
 */
export interface DefaultStage {
  name: string;
  color: string;
  type: "open" | "lost";
  // Porta de entrada: onde pousa o card vindo de outro quadro.
  isInitial?: boolean;
  // Conclui o quadro e empurra o card adiante. Pode haver mais de uma.
  isFinal?: boolean;
}

export interface DefaultBoard {
  name: string;
  color: string;
  stages: DefaultStage[];
}

export const DEFAULT_BOARDS: DefaultBoard[] = [
  {
    name: "Funil de Vendas",
    color: "#2576d2",
    stages: [
      { name: "Novo", color: "#90a4ae", type: "open", isInitial: true },
      { name: "Contato feito", color: "#42a5f5", type: "open" },
      { name: "Proposta enviada", color: "#ab47bc", type: "open" },
      { name: "Negociação", color: "#ffa726", type: "open" },
      { name: "Ganho", color: "#66bb6a", type: "open", isFinal: true },
      { name: "Perdido", color: "#ef5350", type: "lost" }
    ]
  },
  {
    name: "Produção",
    color: "#ffa726",
    stages: [
      { name: "Na fila", color: "#90a4ae", type: "open", isInitial: true },
      { name: "Em produção", color: "#42a5f5", type: "open" },
      { name: "Acabamento", color: "#ab47bc", type: "open" },
      { name: "Pronto", color: "#66bb6a", type: "open", isFinal: true }
    ]
  },
  {
    name: "Expedição",
    color: "#26a69a",
    stages: [
      { name: "A separar", color: "#90a4ae", type: "open", isInitial: true },
      { name: "Em rota", color: "#42a5f5", type: "open" },
      { name: "Entregue", color: "#66bb6a", type: "open", isFinal: true }
    ]
  },
  {
    name: "Financeiro",
    color: "#66bb6a",
    stages: [
      { name: "A faturar", color: "#90a4ae", type: "open", isInitial: true },
      { name: "Faturado", color: "#42a5f5", type: "open" },
      { name: "Pago", color: "#66bb6a", type: "open", isFinal: true }
    ]
  }
];

export default DEFAULT_BOARDS;
