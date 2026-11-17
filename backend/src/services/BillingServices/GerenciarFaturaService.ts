import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import CompanyInvoice from "../../models/CompanyInvoice";
import { logger } from "../../utils/logger";
import { provedorDeCobranca } from "./index";

/**
 * Operações sobre uma fatura já emitida.
 *
 * Ficam juntas porque compartilham a mesma regra silenciosa: toda mudança de
 * situação de fatura pode desbloquear (ou voltar a bloquear) o acesso da
 * empresa, e essa consequência precisa acontecer no mesmo lugar em que a
 * situação muda. Espalhada por quatro arquivos, uma delas esqueceria.
 */

/**
 * Marca do bloqueio feito pelo próprio sistema.
 *
 * É o que distingue "suspensa porque não pagou" de "suspensa porque alguém
 * decidiu": só a primeira é desfeita sozinha quando a dívida some.
 */
export const MOTIVO_AUTOMATICO = "Fatura em atraso";

const buscar = async (invoiceId: number): Promise<CompanyInvoice> => {
  const invoice = await CompanyInvoice.findByPk(invoiceId, {
    include: [{ model: Company, as: "company" }]
  });

  if (!invoice) {
    throw new AppError("ERR_NO_INVOICE_FOUND", 404);
  }

  return invoice;
};

/**
 * Quantas faturas vencidas a empresa tem, passada a tolerância.
 *
 * "Vencida" não é campo gravado: é a fatura em aberto cujo vencimento já
 * passou. Calcular na consulta evita que a tela mostre uma situação diferente
 * do banco entre duas execuções do job.
 */
export const faturasVencidas = async (
  companyId: number,
  diasDeTolerancia = 0
): Promise<CompanyInvoice[]> => {
  const limite = new Date();
  limite.setDate(limite.getDate() - Number(diasDeTolerancia || 0));

  return CompanyInvoice.findAll({
    where: {
      companyId,
      status: { [Op.in]: ["pending", "overdue"] },
      dueDate: { [Op.lt]: limite.toISOString().slice(0, 10) }
    },
    order: [["dueDate", "ASC"]]
  });
};

/**
 * Devolve o acesso quando não sobrou nada vencido.
 *
 * Só mexe em empresa que o próprio sistema bloqueou por inadimplência: quem
 * foi suspenso à mão, por qualquer outro motivo, continua suspenso até alguém
 * decidir o contrário. Pagar uma fatura não pode reabrir uma conta que foi
 * fechada de propósito.
 */
export const reavaliarBloqueio = async (companyId: number): Promise<void> => {
  const company = await Company.findByPk(companyId);
  if (!company) return;

  const pendentes = await faturasVencidas(companyId, company.overdueGraceDays);

  if (pendentes.length === 0 && company.statusReason === MOTIVO_AUTOMATICO) {
    await company.update({
      status: "active",
      statusReason: null,
      statusChangedAt: new Date()
    });
    logger.info(`Empresa ${companyId} reativada: nada vencido em aberto.`);
  }
};

/** Baixa manual: o dinheiro entrou por fora do gateway. */
export const baixarFatura = async (
  invoiceId: number,
  dados: { paidAt?: string; paidAmount?: number; notes?: string } = {}
): Promise<CompanyInvoice> => {
  const invoice = await buscar(invoiceId);

  if (invoice.status === "canceled") {
    throw new AppError("ERR_INVOICE_CANCELED", 400);
  }

  await invoice.update({
    status: "paid",
    paidAt: dados.paidAt ? new Date(dados.paidAt) : new Date(),
    paidAmount: dados.paidAmount ?? invoice.amount,
    notes: dados.notes ?? invoice.notes
  });

  await reavaliarBloqueio(invoice.companyId);
  await invoice.reload();
  return invoice;
};

/** Desfaz a baixa: erro de lançamento, estorno, boleto que voltou. */
export const estornarFatura = async (
  invoiceId: number
): Promise<CompanyInvoice> => {
  const invoice = await buscar(invoiceId);

  await invoice.update({ status: "pending", paidAt: null, paidAmount: null });
  await invoice.reload();
  return invoice;
};

/**
 * Cancela a fatura, e no gateway também quando ela nasceu lá.
 *
 * Cancelar só de um lado deixaria o cliente com um boleto vivo para uma
 * cobrança que o sistema considera morta.
 */
export const cancelarFatura = async (
  invoiceId: number
): Promise<CompanyInvoice> => {
  const invoice = await buscar(invoiceId);

  if (invoice.status === "paid") {
    throw new AppError("ERR_INVOICE_ALREADY_PAID", 400);
  }

  if (invoice.providerChargeId) {
    const provedor = provedorDeCobranca();
    if (provedor.configurado()) {
      try {
        await provedor.cancelar(invoice.providerChargeId);
      } catch (erro) {
        // O cancelamento local acontece de qualquer jeito: uma cobrança que o
        // gateway se recusa a apagar não pode travar o controle interno. O
        // motivo fica gravado para alguém resolver lá.
        await invoice.update({
          lastError: (erro as Error).message?.slice(0, 500) || null
        });
      }
    }
  }

  await invoice.update({ status: "canceled" });
  await reavaliarBloqueio(invoice.companyId);
  await invoice.reload();
  return invoice;
};

/** Puxa do gateway a situação atual — usado quando o webhook não chegou. */
export const sincronizarFatura = async (
  invoiceId: number
): Promise<CompanyInvoice> => {
  const invoice = await buscar(invoiceId);

  if (!invoice.providerChargeId) {
    throw new AppError("ERR_INVOICE_NOT_FROM_PROVIDER", 400);
  }

  const provedor = provedorDeCobranca();

  if (!provedor.configurado()) {
    throw new AppError("ERR_BILLING_NOT_CONFIGURED", 400);
  }

  const cobranca = await provedor.consultar(invoice.providerChargeId);

  await invoice.update({
    status: cobranca.situacao,
    paidAt: cobranca.pagoEm || invoice.paidAt,
    paidAmount: cobranca.valorPago ?? invoice.paidAmount,
    bankSlipUrl: cobranca.urlBoleto || invoice.bankSlipUrl,
    digitableLine: cobranca.linhaDigitavel || invoice.digitableLine,
    pixPayload: cobranca.pixCopiaECola || invoice.pixPayload,
    invoiceUrl: cobranca.urlFatura || invoice.invoiceUrl,
    lastError: null
  });

  await reavaliarBloqueio(invoice.companyId);
  await invoice.reload();
  return invoice;
};

export default {
  baixarFatura,
  estornarFatura,
  cancelarFatura,
  sincronizarFatura,
  faturasVencidas,
  reavaliarBloqueio
};
