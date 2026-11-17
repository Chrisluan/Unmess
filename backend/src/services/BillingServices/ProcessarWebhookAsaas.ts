import CompanyInvoice from "../../models/CompanyInvoice";
import { logger } from "../../utils/logger";
import { reavaliarBloqueio } from "./GerenciarFaturaService";

/**
 * Eventos do Asaas que mudam a situação de uma cobrança.
 *
 * A lista é explícita: o Asaas dispara dezenas de eventos, e reagir aos que
 * não foram previstos é como um erro de digitação vira baixa indevida.
 */
const EVENTOS: Record<string, "paid" | "pending" | "overdue" | "canceled"> = {
  PAYMENT_CONFIRMED: "paid",
  PAYMENT_RECEIVED: "paid",
  PAYMENT_RECEIVED_IN_CASH: "paid",
  PAYMENT_OVERDUE: "overdue",
  PAYMENT_DELETED: "canceled",
  PAYMENT_RESTORED: "pending",
  PAYMENT_REFUNDED: "canceled",
  PAYMENT_UPDATED: "pending"
};

interface Evento {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    netValue?: number;
    paymentDate?: string;
    bankSlipUrl?: string;
    invoiceUrl?: string;
  };
}

/**
 * Aplica um aviso do gateway na fatura correspondente.
 *
 * Não lança quando não reconhece o evento nem quando não acha a fatura: o
 * Asaas repete a entrega enquanto não receber 200, e ficar reenviando para
 * sempre um aviso de cobrança que não é nossa só entope a fila dos dois lados.
 * O que não foi tratado vira log.
 */
const ProcessarWebhookAsaas = async (evento: Evento): Promise<void> => {
  const nome = evento?.event;
  const cobrancaId = evento?.payment?.id;

  if (!nome || !cobrancaId) {
    logger.warn("Webhook do Asaas sem evento ou sem id de cobranca.");
    return;
  }

  const novaSituacao = EVENTOS[nome];

  if (!novaSituacao) {
    logger.info(`Webhook do Asaas ignorado: evento ${nome}.`);
    return;
  }

  const invoice = await CompanyInvoice.findOne({
    where: { providerChargeId: cobrancaId }
  });

  if (!invoice) {
    logger.warn(
      `Webhook do Asaas para cobranca ${cobrancaId}, que nao existe aqui.`
    );
    return;
  }

  // Fatura cancelada aqui não volta por aviso de "atualizada": o cancelamento
  // é decisão de quem opera, e o gateway não sabe disso.
  if (invoice.status === "canceled" && novaSituacao !== "paid") {
    return;
  }

  const pagamento = evento.payment || {};

  await invoice.update({
    status: novaSituacao,
    paidAt:
      novaSituacao === "paid"
        ? pagamento.paymentDate
          ? new Date(pagamento.paymentDate)
          : new Date()
        : null,
    paidAmount:
      novaSituacao === "paid"
        ? pagamento.netValue ?? pagamento.value ?? invoice.amount
        : null,
    bankSlipUrl: pagamento.bankSlipUrl || invoice.bankSlipUrl,
    invoiceUrl: pagamento.invoiceUrl || invoice.invoiceUrl
  });

  logger.info(
    `Fatura ${invoice.id} da empresa ${invoice.companyId}: ${nome} -> ${novaSituacao}.`
  );

  await reavaliarBloqueio(invoice.companyId);
};

export default ProcessarWebhookAsaas;
