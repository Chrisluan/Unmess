import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import CompanyInvoice from "../../models/CompanyInvoice";
import { logger } from "../../utils/logger";
import { provedorDeCobranca } from "./index";

interface Request {
  companyId: number;
  /** Em reais. Vazio usa a mensalidade cadastrada na empresa. */
  amount?: number;
  /** ISO curto. Vazio usa o dia de vencimento da empresa no mês que vem. */
  dueDate?: string;
  description?: string;
  billingType?: "boleto" | "pix";
  /**
   * Registra a fatura sem falar com o gateway. Serve para lançar a cobrança
   * que foi emitida direto no banco, e é o caminho automático quando não há
   * credencial configurada.
   */
  manual?: boolean;
  digitableLine?: string;
  bankSlipUrl?: string;
  notes?: string;
}

/**
 * Próximo vencimento a partir do dia cadastrado na empresa.
 *
 * Se o dia já passou neste mês, vai para o mês seguinte — cobrar com data
 * retroativa nasce vencido, e o boleto sai inutilizável.
 */
const proximoVencimento = (dia: number): string => {
  const hoje = new Date();
  const seguro = Math.min(Math.max(Number(dia) || 10, 1), 28);
  let alvo = new Date(hoje.getFullYear(), hoje.getMonth(), seguro);
  if (alvo <= hoje) {
    alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, seguro);
  }
  return alvo.toISOString().slice(0, 10);
};

const competencia = (vencimento: string): string => {
  const [ano, mes] = vencimento.split("-");
  return `${mes}/${ano}`;
};

/**
 * Emite uma cobrança para a empresa assinante.
 *
 * A fatura é gravada antes de falar com o gateway, e não depois: se a chamada
 * externa falhar no meio, o registro fica com `status = "failed"` e o motivo à
 * vista, em vez de sumir e deixar a dúvida de se chegou a ser criada lá. Uma
 * cobrança perdida entre os dois lados é pior que uma marcada como falha.
 */
const EmitirFaturaService = async ({
  companyId,
  amount,
  dueDate,
  description,
  billingType = "boleto",
  manual = false,
  digitableLine,
  bankSlipUrl,
  notes
}: Request): Promise<CompanyInvoice> => {
  const company = await Company.findByPk(companyId);

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const valor = Number(amount ?? company.monthlyFee);

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new AppError("ERR_INVOICE_AMOUNT_REQUIRED", 400);
  }

  const vencimento = dueDate || proximoVencimento(company.billingDay);
  const provedor = provedorDeCobranca();
  const automatica = !manual && provedor.configurado();

  const invoice = await CompanyInvoice.create({
    companyId,
    description: description || `Mensalidade ${competencia(vencimento)}`,
    amount: valor,
    dueDate: vencimento,
    status: "pending",
    billingType,
    provider: automatica ? provedor.nome : "manual",
    digitableLine: digitableLine || null,
    bankSlipUrl: bankSlipUrl || null,
    notes: notes || null
  } as any);

  if (!automatica) {
    return invoice;
  }

  try {
    const clienteId = await provedor.garantirCliente(
      {
        nome: company.name,
        documento: company.document,
        email: company.email,
        telefone: company.phone
      },
      company.billingCustomerId
    );

    if (clienteId !== company.billingCustomerId) {
      await company.update({ billingCustomerId: clienteId });
    }

    const cobranca = await provedor.emitir({
      clienteId,
      valor,
      vencimento,
      descricao: invoice.description,
      tipo: billingType
    });

    await invoice.update({
      providerChargeId: cobranca.id,
      status: cobranca.situacao,
      bankSlipUrl: cobranca.urlBoleto || null,
      digitableLine: cobranca.linhaDigitavel || null,
      pixPayload: cobranca.pixCopiaECola || null,
      invoiceUrl: cobranca.urlFatura || null,
      lastError: null
    });
  } catch (erro) {
    const motivo = (erro as Error).message?.slice(0, 500) || "Falha desconhecida";
    logger.error(
      `Falha ao emitir cobranca da empresa ${companyId}: ${motivo}`
    );
    await invoice.update({ status: "failed", lastError: motivo });
    // A fatura fica registrada como falha para o super ver e reemitir; o erro
    // sobe para a tela dizer o que o gateway respondeu.
    throw erro;
  }

  await invoice.reload();
  return invoice;
};

export default EmitirFaturaService;
