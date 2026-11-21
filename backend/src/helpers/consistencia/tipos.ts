/**
 * Vocabulário do motor de consistência de configurações.
 *
 * Uma regra diz "se A está assim, B precisa estar assado". Ela não lê o banco:
 * pede o que precisa a uma `FonteDeDados`. Assim a mesma regra roda dentro da
 * transação de uma alteração (para decidir se a alteração pode ser gravada),
 * no painel de saúde e nos testes, com dados de mentira.
 */

/**
 * `bloqueia`: a alteração que cria o problema é recusada.
 * `aviso`: aparece no painel, mas não impede nada. É o caso do que depende de
 * estado (conexão caiu) e não de configuração: recusar uma gravação por causa
 * de um celular sem bateria seria punir quem está trabalhando.
 */
export type Severidade = "bloqueia" | "aviso";

/** O que, ao mudar, pode criar ou resolver o problema. */
export type Gatilho =
  | "configuracao"
  | "statusDeTicket"
  | "fila"
  | "horario"
  | "quadro"
  | "etapa"
  | "conexao"
  | "financeiro"
  | "empresa"
  | "produto"
  | "insumo";

/** Para onde mandar quem quer resolver: rota do frontend e o texto do botão. */
export interface Atalho {
  rota: string;
  rotulo: string;
}

export interface Problema {
  regra: string;
  titulo: string;
  mensagem: string;
  severidade: Severidade;
  resolver: Atalho;
}

// Formas mínimas que as regras enxergam. São subconjuntos dos modelos, de
// propósito: a regra não deve depender de nada além do que usa.

export interface StatusDeTicket {
  id: number;
  name: string;
  type: string;
  isDefault: boolean;
}

export interface Fila {
  id: number;
  name: string;
  isDefault: boolean;
  usuarios: number;
  conexoes: number[];
}

export interface DiaDeAtendimento {
  weekDay: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface Quadro {
  id: number;
  name: string;
  isSalesFunnel: boolean;
}

export interface Etapa {
  id: number;
  name: string;
  boardId: number;
  type: string;
  isInitial: boolean;
  isFinal: boolean;
  isWon: boolean;
  active: boolean;
  targetBoardId: number | null;
  targetStageId: number | null;
}

export interface Conexao {
  id: number;
  name: string;
  status: string;
  filas: number[];
}

export interface ContaFinanceira {
  id: number;
  name: string;
  kind: string;
  active: boolean;
}

export interface DadosDaEmpresa {
  name: string;
  legalName: string | null;
  document: string | null;
  address: string | null;
}

/** Produto de preço calculado, com o que a composição dele usa. */
export interface ProdutoCalculado {
  id: number;
  name: string;
  active: boolean;
  componentes: number;
  insumosInativos: string[];
}

export interface FonteDeDados {
  /** Valor da configuração, já com o padrão do catálogo quando não existe. */
  configuracao(chave: string): Promise<string>;
  statusDeTicket(): Promise<StatusDeTicket[]>;
  filas(): Promise<Fila[]>;
  horarios(): Promise<DiaDeAtendimento[]>;
  quadros(): Promise<Quadro[]>;
  etapas(): Promise<Etapa[]>;
  conexoes(): Promise<Conexao[]>;
  contasFinanceiras(): Promise<ContaFinanceira[]>;
  empresa(): Promise<DadosDaEmpresa | null>;
  produtosCalculados(): Promise<ProdutoCalculado[]>;
}

export interface Regra {
  id: string;
  titulo: string;
  severidade: Severidade;
  gatilhos: Gatilho[];
  resolver: Atalho;
  /** Devolve uma mensagem por ocorrência do problema; vazio = tudo certo. */
  verificar(dados: FonteDeDados): Promise<string[]>;
}
