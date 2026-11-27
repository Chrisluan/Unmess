import AppError from "../../errors/AppError";
import sequelize from "../../database";
import Customer from "../../models/Customer";
import FinancialEntry from "../../models/FinancialEntry";
import Order from "../../models/Order";
import Receivable from "../../models/Receivable";
import { logger } from "../../utils/logger";
import { CobrancaEmitida } from "../BillingServices/BillingProvider";
import { chaveDoCliente, integracaoAtiva, provedorDa } from "./Integracao";

interface Request {
  receivableId: number | string;
  companyId: number;
  /** Sobrepõe o tipo padrão da integração para esta parcela. */
  tipo?: "boleto" | "pix" | "indefinido";
}

/** Data local (o servidor roda no fuso da empresa), no formato do gateway. */
export const hojeLocal = (): string => {
  const agora = new Date();
  const mm = String(agora.getMonth() + 1).padStart(2, "0");
  const dd = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mm}-${dd}`;
};

const somenteDigitos = (valor?: string | null): string => String(valor || "").replace(/\D/g, "");

/** Situações de lá em que a cobrança ainda pode ser paga. */
export const COBRANCA_VIVA = ["pending", "overdue"];

/**
 * Emite (ou reaproveita) a cobrança de uma parcela no gateway.
 *
 * Cobra **o saldo**, não o valor original: se a parcela já recebeu uma baixa
 * parcial, o boleto sai pelo que falta. Parcela quitada ou cancelada não
 * emite -- o botão nem aparece, e a API recusa do mesmo jeito.
 *
 * Reaproveita a cobrança que já existe quando ela ainda vale: mesmo ambiente,
 * mesmo valor, ainda no prazo e do mesmo tipo. Assim imprimir o documento duas
 * vezes não gera dois boletos para o cliente. Quando não vale mais (valor
 * mudou por baixa parcial, venceu, mudou o tipo), a antiga é cancelada lá
 * **antes** de emitir a nova; se o cancelamento falhar, nada é emitido -- dois
 * boletos vivos para a mesma parcela é como o cliente paga duas vezes.
 *
 * A linha da parcela fica travada (SELECT ... FOR UPDATE) durante a emissão:
 * dois cliques ao mesmo tempo esperam um pelo outro, e o segundo encontra a
 * cobrança que o primeiro acabou de criar.
 */
const EmitirCobrancaService = async ({
  receivableId,
  companyId,
  tipo
}: Request): Promise<Receivable> => {
  const integracao = await integracaoAtiva(companyId);
  const provedor = provedorDa(integracao);
  const tipoFinal = (tipo || integracao.billingType || "indefinido") as "boleto" | "pix" | "indefinido";
  const chaveCliente = chaveDoCliente(integracao);

  return sequelize.transaction(async transaction => {
    const parcela = await Receivable.findOne({
      where: { id: receivableId, companyId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!parcela) throw new AppError("ERR_NO_RECEIVABLE_FOUND", 404);
    if (parcela.canceledAt) throw new AppError("ERR_RECEIVABLE_CANCELED", 409);

    const baixas = await FinancialEntry.sum("amount", {
      where: { receivableId: parcela.id, companyId },
      transaction
    });
    const saldo = Number((parcela.amount - Number(baixas || 0)).toFixed(2));
    if (saldo <= 0.005) throw new AppError("ERR_RECEIVABLE_ALREADY_PAID", 409);

    const hoje = hojeLocal();
    const vencimento = parcela.dueDate > hoje ? parcela.dueDate : hoje;

    const viva = Boolean(parcela.gatewayChargeId) && COBRANCA_VIVA.includes(parcela.gatewayStatus);
    const aproveitavel =
      viva &&
      parcela.gatewayEnvironment === integracao.environment &&
      parcela.gatewayStatus === "pending" &&
      Math.abs((parcela.gatewayAmount ?? -1) - saldo) < 0.005 &&
      (parcela.gatewayDueDate || "") >= hoje &&
      (!tipo || parcela.gatewayBillingType === tipo);

    if (aproveitavel) return parcela;

    if (viva) {
      // Cobrança antiga no ambiente atual: cancela lá. De outro ambiente
      // (sandbox de quando a empresa testava), não há como -- a chave é outra
      // -- e ela não cobra ninguém de verdade.
      if (parcela.gatewayEnvironment === integracao.environment) {
        await provedor.cancelar(parcela.gatewayChargeId);
      }
      await parcela.update({ gatewayStatus: "canceled" }, { transaction });
    }

    // Cliente: o da parcela, ou o do pedido de onde ela veio.
    let customerId: number | null = parcela.customerId;
    if (!customerId && parcela.orderId) {
      const pedido = await Order.findOne({
        where: { id: parcela.orderId, companyId },
        attributes: ["customerId"],
        transaction
      });
      customerId = pedido?.customerId || null;
    }
    if (!customerId) throw new AppError("ERR_COBRANCA_SEM_CLIENTE", 400);

    const cliente = await Customer.findOne({ where: { id: customerId, companyId }, transaction });
    if (!cliente) throw new AppError("ERR_COBRANCA_SEM_CLIENTE", 400);

    // O gateway exige CPF ou CNPJ para emitir boleto, e o banco exige o nome.
    // Melhor dizer aqui, com o atalho para o cadastro, do que repassar o erro
    // genérico de lá.
    const documento = somenteDigitos(cliente.document);
    const nome = (cliente.name || cliente.tradeName || "").trim();
    if (!nome || ![11, 14].includes(documento.length)) {
      throw new AppError("ERR_CLIENTE_SEM_DOCUMENTO", 400, { customerId: cliente.id });
    }

    const dadosDoCliente = {
      nome,
      documento,
      email: cliente.email || null,
      telefone: cliente.whatsapp || cliente.phone || null
    };

    const ids = { ...cliente.gatewayIds };
    let clienteNoGateway: string;
    try {
      clienteNoGateway = await provedor.garantirCliente(dadosDoCliente, ids[chaveCliente] || null);
    } catch (erro) {
      // O id guardado pode ter sido apagado no painel do gateway. Uma segunda
      // tentativa, criando de novo; se falhar também, o erro é de verdade.
      if (!ids[chaveCliente]) throw erro;
      clienteNoGateway = await provedor.garantirCliente(dadosDoCliente, null);
    }
    if (ids[chaveCliente] !== clienteNoGateway) {
      ids[chaveCliente] = clienteNoGateway;
      cliente.gatewayIds = ids;
      await cliente.save({ transaction });
    }

    const emitida: CobrancaEmitida = await provedor.emitir({
      clienteId: clienteNoGateway,
      valor: saldo,
      vencimento,
      descricao: String(parcela.description || `Parcela ${parcela.installment}/${parcela.installments}`).slice(0, 480),
      tipo: tipoFinal,
      referenciaExterna: `rcv:${parcela.id}`
    });

    try {
      return await parcela.update(
        {
          gatewayProvider: integracao.provider,
          gatewayEnvironment: integracao.environment,
          gatewayChargeId: emitida.id,
          gatewayStatus: emitida.situacao,
          gatewayBillingType: tipoFinal,
          gatewayAmount: saldo,
          gatewayDueDate: vencimento,
          boletoUrl: emitida.urlBoleto || null,
          invoiceUrl: emitida.urlFatura || null,
          linhaDigitavel: emitida.linhaDigitavel || null,
          pixCopiaECola: emitida.pixCopiaECola || null,
          pixQrCode: emitida.pixQrCode || null,
          emittedAt: new Date(),
          gatewayCheckedAt: new Date(),
          ...(customerId !== parcela.customerId ? { customerId } : {})
        } as never,
        { transaction }
      );
    } catch (erro) {
      // Emitiu lá e não gravou aqui: a cobrança ficaria viva sem ninguém
      // acompanhando. Desfaz lá, e se nem isso der, deixa o rastro no log.
      await provedor.cancelar(emitida.id).catch(() =>
        logger.error(
          `Cobranca ${emitida.id} emitida para a parcela ${parcela.id} sem registro local; cancele no painel do gateway.`
        )
      );
      throw erro;
    }
  });
};

export default EmitirCobrancaService;
