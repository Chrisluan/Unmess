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

const TIPOS = { boleto: "BOLETO", pix: "PIX" };

/** Só dígitos: o Asaas recusa CPF/CNPJ com ponto e traço. */
const somenteDigitos = (valor?: string | null): string | undefined => {
  if (!valor) return undefined;
  const limpo = valor.replace(/\D/g, "");
  return limpo || undefined;
};

class AsaasProvider implements BillingProvider {
  readonly nome = "asaas";

  private get chave(): string | undefined {
    return process.env.ASAAS_API_KEY;
  }

  private get base(): string {
    const ambiente = process.env.ASAAS_ENV === "production" ? "production" : "sandbox";
    return BASES[ambiente];
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
    const dados = texto ? JSON.parse(texto) : {};

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
      urlFatura: cobranca.invoiceUrl || null,
      valorPago: cobranca.netValue ?? null,
      pagoEm: cobranca.paymentDate ? new Date(cobranca.paymentDate) : null
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
        description: pedido.descricao
      }
    });

    // A linha digitável não vem no POST: é um recurso à parte, e sem ela o
    // cliente não consegue pagar pelo aplicativo do banco.
    if (cobranca.billingType === "BOLETO") {
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

    if (cobranca.billingType === "PIX") {
      try {
        const pix = await this.chamar<any>(`/payments/${cobranca.id}/pixQrCode`);
        cobranca.payload = pix.payload;
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
    await this.chamar(`/payments/${cobrancaId}`, { metodo: "DELETE" });
  }
}

export default AsaasProvider;
