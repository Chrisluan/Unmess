import AppError from "../../errors/AppError";
import {
  BillingProvider,
  CobrancaEmitida,
  DadosDoCliente,
  PedidoDeCobranca
} from "./BillingProvider";

/**
 * Adaptador do Asaas.
 *
 * A chave e o ambiente vêm do .env; sem chave o adaptador se declara não
 * configurado e quem chama cai para emissão manual. Isso é de propósito: a
 * instalação precisa subir e faturar por fora antes de alguém abrir conta no
 * gateway, e um sistema que quebra no clique por falta de credencial não
 * ajuda ninguém.
 *
 *   ASAAS_API_KEY=...            chave da conta (sandbox ou produção)
 *   ASAAS_ENV=sandbox|production padrão: sandbox
 *   ASAAS_WEBHOOK_TOKEN=...      o mesmo valor configurado no painel do Asaas
 */

const BASES = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3"
};

/** O Asaas fala em MAIÚSCULAS e em inglês; o sistema, não. */
const SITUACOES: Record<string, CobrancaEmitida["situacao"]> = {
  PENDING: "pending",
  AWAITING_RISK_ANALYSIS: "pending",
  CONFIRMED: "paid",
  RECEIVED: "paid",
  RECEIVED_IN_CASH: "paid",
  OVERDUE: "overdue",
  REFUNDED: "canceled",
  CHARGEBACK_REQUESTED: "paid",
  DELETED: "canceled",
  CANCELED: "canceled"
};

const TIPOS = { boleto: "BOLETO", pix: "PIX", indefinido: "UNDEFINED" };

export const BASES_DO_ASAAS = BASES;

/** Credencial explícita: a de uma empresa cliente, e não a do SaaS no .env. */
export interface CredencialAsaas {
  chave: string;
  ambiente: "sandbox" | "production";
}

/** Só dígitos: o Asaas recusa CPF/CNPJ com ponto e traço. */
const somenteDigitos = (valor?: string | null): string | undefined => {
  if (!valor) return undefined;
  const limpo = valor.replace(/\D/g, "");
  return limpo || undefined;
};

class AsaasProvider implements BillingProvider {
  readonly nome = "asaas";

  /**
   * Sem credencial, usa a do .env: é o faturamento do próprio SaaS. Com
   * credencial, fala em nome da empresa cliente -- a cobrança das vendas dela.
   */
  constructor(private readonly credencial?: CredencialAsaas) {}

  private get chave(): string | undefined {
    if (this.credencial) return this.credencial.chave;
    return process.env.ASAAS_API_KEY;
  }

  private get base(): string {
    const ambiente = this.credencial
      ? this.credencial.ambiente
      : process.env.ASAAS_ENV === "production"
        ? "production"
        : "sandbox";
    return BASES[ambiente === "production" ? "production" : "sandbox"];
  }

  configurado(): boolean {
    return Boolean(this.chave);
  }

  /**
   * Uma chamada só, com o erro do gateway repassado inteiro.
   *
   * O Asaas devolve `{ errors: [{ code, description }] }` com o motivo em
   * português. Trocar isso por "erro ao emitir cobrança" obrigaria a abrir o
   * log do servidor para descobrir que o CPF estava inválido.
   */
  private async chamar<T>(
    caminho: string,
    opcoes: { metodo?: string; corpo?: unknown } = {}
  ): Promise<T> {
    if (!this.chave) {
      throw new AppError("ERR_BILLING_NOT_CONFIGURED", 400);
    }

    let resposta: Response;
    try {
      resposta = await fetch(`${this.base}${caminho}`, {
        method: opcoes.metodo || "GET",
        headers: {
          "Content-Type": "application/json",
          access_token: this.chave
        },
        body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined
      });
    } catch (erro) {
      // Rede fora, DNS, timeout: nada disso é culpa de quem clicou, e a
      // mensagem precisa dizer que é o gateway, não o sistema.
      throw new AppError(
        `Não foi possível falar com o Asaas: ${(erro as Error).message}`,
        502
      );
    }

    const texto = await resposta.text();
    let dados: any = {};
    try {
      dados = texto ? JSON.parse(texto) : {};
    } catch {
      // Página de erro em HTML (manutenção, proxy): o status já diz o bastante.
      dados = {};
    }

    if (resposta.status === 401) {
      throw new AppError("ERR_INTEGRACAO_CHAVE_RECUSADA", 400);
    }

    if (!resposta.ok) {
      const descricao =
        dados?.errors?.map((e: any) => e.description).join(" ") ||
        `Asaas respondeu ${resposta.status}`;
      throw new AppError(descricao, 400);
    }

    return dados as T;
  }

  private traduzir(cobranca: any): CobrancaEmitida {
    return {
      id: cobranca.id,
      situacao: SITUACOES[cobranca.status] || "pending",
      urlBoleto: cobranca.bankSlipUrl || null,
      linhaDigitavel: cobranca.identificationField || null,
      pixCopiaECola: cobranca.payload || null,
      pixQrCode: cobranca.encodedImage || null,
      urlFatura: cobranca.invoiceUrl || null,
      valorPago: cobranca.netValue ?? null,
      valor: cobranca.value ?? null,
      vencimento: cobranca.dueDate || null,
      forma:
        cobranca.billingType === "PIX"
          ? "pix"
          : cobranca.billingType === "BOLETO"
            ? "boleto"
            : cobranca.billingType === "CREDIT_CARD" || cobranca.billingType === "DEBIT_CARD"
              ? "cartao"
              : null,
      pagoEm: cobranca.paymentDate
        ? new Date(`${cobranca.paymentDate}T12:00:00`)
        : cobranca.clientPaymentDate
          ? new Date(`${cobranca.clientPaymentDate}T12:00:00`)
          : null,
      estornada: ["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS", "CHARGEBACK_REQUESTED"].includes(cobranca.status)
    };
  }

  async garantirCliente(
    dados: DadosDoCliente,
    clienteIdExistente?: string | null
  ): Promise<string> {
    // Já existe lá: atualiza para o boleto sair com o nome e o documento
    // atuais, e devolve o mesmo id.
    if (clienteIdExistente) {
      await this.chamar(`/customers/${clienteIdExistente}`, {
        metodo: "POST",
        corpo: {
          name: dados.nome,
          cpfCnpj: somenteDigitos(dados.documento),
          email: dados.email || undefined,
          mobilePhone: somenteDigitos(dados.telefone)
        }
      });
      return clienteIdExistente;
    }

    const criado = await this.chamar<{ id: string }>("/customers", {
      metodo: "POST",
      corpo: {
        name: dados.nome,
        cpfCnpj: somenteDigitos(dados.documento),
        email: dados.email || undefined,
        mobilePhone: somenteDigitos(dados.telefone)
      }
    });

    return criado.id;
  }

  async emitir(pedido: PedidoDeCobranca): Promise<CobrancaEmitida> {
    const cobranca = await this.chamar<any>("/payments", {
      metodo: "POST",
      corpo: {
        customer: pedido.clienteId,
        billingType: TIPOS[pedido.tipo || "boleto"],
        value: Number(pedido.valor),
        dueDate: pedido.vencimento,
        description: pedido.descricao,
        externalReference: pedido.referenciaExterna || undefined
      }
    });

    // A linha digitável não vem no POST: é um recurso à parte, e sem ela o
    // cliente não consegue pagar pelo aplicativo do banco.
    if (cobranca.billingType === "BOLETO" || cobranca.billingType === "UNDEFINED") {
      try {
        const boleto = await this.chamar<any>(
          `/payments/${cobranca.id}/identificationField`
        );
        cobranca.identificationField = boleto.identificationField;
      } catch {
        // Emitiu mas a linha ainda não saiu. O PDF já resolve o pagamento, e
        // a sincronização posterior busca de novo.
      }
    }

    // Boleto também pode ter Pix (o "bolepix") quando a conta tem chave Pix
    // cadastrada; sem chave, a chamada falha e o documento sai só com o boleto.
    {
      try {
        const pix = await this.chamar<any>(`/payments/${cobranca.id}/pixQrCode`);
        cobranca.payload = pix.payload;
        cobranca.encodedImage = pix.encodedImage;
      } catch {
        // Idem: o link da fatura continua servindo.
      }
    }

    return this.traduzir(cobranca);
  }

  async consultar(cobrancaId: string): Promise<CobrancaEmitida> {
    const cobranca = await this.chamar<any>(`/payments/${cobrancaId}`);
    return this.traduzir(cobranca);
  }

  async cancelar(cobrancaId: string): Promise<void> {
    try {
      await this.chamar(`/payments/${cobrancaId}`, { metodo: "DELETE" });
    } catch (erro) {
      // Já removida lá (por alguém no painel do Asaas, ou numa tentativa
      // anterior que caiu antes de gravar aqui): o objetivo foi atingido.
      const situacao = await this.consultar(cobrancaId).catch(() => null);
      if (situacao && situacao.situacao === "canceled") return;
      throw erro;
    }
  }

  /**
   * Confere se a chave funciona, sem efeito colateral nenhum.
   * Devolve o nome da conta para a tela mostrar "conectado como ...".
   */
  async testar(): Promise<{ conta: string | null }> {
    const conta = await this.chamar<any>("/myAccount/commercialInfo").catch(async erro => {
      // Contas antigas sem esse recurso: listar clientes também prova a chave.
      if (erro instanceof AppError && erro.message === "ERR_INTEGRACAO_CHAVE_RECUSADA") throw erro;
      await this.chamar("/customers?limit=1");
      return null;
    });
    return { conta: conta?.companyName || conta?.name || null };
  }
}

export default AsaasProvider;
