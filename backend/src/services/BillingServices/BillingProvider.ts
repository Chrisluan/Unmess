/**
 * Contrato do gateway de cobrança.
 *
 * Existe para que trocar de provedor seja escrever um arquivo, e não mexer nas
 * telas, nas rotas e no modelo. A escolha do gateway é comercial — muda com
 * tarifa, com banco, com o humor do gerente da conta — e não pode arrastar o
 * resto do sistema junto.
 *
 * Tudo aqui fala a língua do sistema, em português e em reais. A tradução para
 * o formato de cada gateway acontece dentro do adaptador.
 */

export interface DadosDoCliente {
  nome: string;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
}

export interface PedidoDeCobranca {
  /** Id do cliente no gateway, obtido por `garantirCliente`. */
  clienteId: string;
  valor: number;
  /** ISO curto: "2026-09-10". */
  vencimento: string;
  descricao: string;
  /** boleto | pix — cartão recorrente fica para quando houver assinatura. */
  tipo?: "boleto" | "pix";
}

export interface CobrancaEmitida {
  /** Id da cobrança no gateway. */
  id: string;
  /** pending | paid | overdue | canceled */
  situacao: "pending" | "paid" | "overdue" | "canceled";
  /** PDF do boleto. */
  urlBoleto?: string | null;
  /** Linha digitável, para quem paga pelo aplicativo do banco. */
  linhaDigitavel?: string | null;
  /** Copia-e-cola do Pix. */
  pixCopiaECola?: string | null;
  /** Página de cobrança hospedada pelo gateway. */
  urlFatura?: string | null;
  valorPago?: number | null;
  pagoEm?: Date | null;
}

export interface BillingProvider {
  /** Nome curto gravado na fatura: "asaas", "manual". */
  readonly nome: string;

  /**
   * Se o adaptador tem o que precisa para operar. Falso quando falta
   * credencial — e nesse caso o sistema cai para emissão manual em vez de
   * quebrar na cara de quem clicou.
   */
  configurado(): boolean;

  /** Cria o cliente no gateway se ainda não existir, e devolve o id de lá. */
  garantirCliente(
    dados: DadosDoCliente,
    clienteIdExistente?: string | null
  ): Promise<string>;

  emitir(pedido: PedidoDeCobranca): Promise<CobrancaEmitida>;

  consultar(cobrancaId: string): Promise<CobrancaEmitida>;

  cancelar(cobrancaId: string): Promise<void>;
}
