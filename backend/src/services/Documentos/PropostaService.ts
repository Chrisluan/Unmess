import AppError from "../../errors/AppError";
import valorLiquidoDoNegocio from "../../helpers/ValorLiquidoDoNegocio";
import Contact from "../../models/Contact";
import Customer from "../../models/Customer";
import Deal from "../../models/Deal";
import DealItem from "../../models/DealItem";
import PaymentTerm from "../../models/PaymentTerm";
import User from "../../models/User";
import {
  blocoDeTotais,
  campo,
  data,
  empresaDoDocumento,
  escapar,
  montarDocumento,
  observacoes,
  tabelaDeItens
} from "./modelo";

interface Request {
  dealId: number | string;
  companyId: number;
  mostrarValores?: boolean;
}

const entrega = (deal: Deal): string => {
  if (deal.deliveryToArrange) return "A combinar";
  const quando = deal.deliveryAt ? new Date(deal.deliveryAt).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }) : "—";
  const modo =
    deal.deliveryMode === "delivery"
      ? `Entrega${deal.carrier ? ` (${deal.carrier})` : ""}`
      : deal.deliveryMode === "pickup"
        ? "Retirada"
        : "";
  return [quando, modo].filter(Boolean).join(" · ");
};

/**
 * Proposta comercial: o documento que vai para o cliente aprovar.
 *
 * Diferente da ordem de produção, fala com o cliente: traz condição de
 * pagamento, validade e o espaço do aceite, e não traz os campos de
 * conferência da oficina.
 */
const PropostaService = async ({
  dealId,
  companyId,
  mostrarValores = true
}: Request): Promise<string> => {
  const deal = await Deal.findOne({
    where: { id: dealId, companyId },
    include: [
      {
        model: DealItem,
        as: "items",
        separate: true,
        order: [["position", "ASC"], ["id", "ASC"]]
      },
      { model: Customer, as: "customer" },
      { model: Contact, as: "contact", attributes: ["id", "name", "number", "email"] },
      { model: User, as: "responsibleUser", attributes: ["id", "name"] },
      { model: PaymentTerm, as: "paymentTerm", attributes: ["id", "name"] }
    ]
  });

  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  const empresa = await empresaDoDocumento(companyId);
  const itens = (deal.items || []) as DealItem[];
  const total = valorLiquidoDoNegocio(deal);

  const cliente = deal.customer;
  const nomeCliente =
    cliente?.tradeName || cliente?.name || deal.contact?.name || "Cliente não identificado";
  const numero = String(deal.quoteNumber || deal.id);

  const pagamento = [
    deal.paymentTerm?.name,
    deal.installments && deal.installments > 1 ? `${deal.installments}x` : null,
    deal.paymentCondition
  ]
    .filter(Boolean)
    .join(" · ");

  const corpo = `
    <section class="dados">
      ${campo("Cliente", nomeCliente)}
      ${campo("CNPJ/CPF", cliente?.document)}
      ${campo("Contato", [cliente?.phone || deal.contact?.number, cliente?.email || deal.contact?.email].filter(Boolean).join(" · "))}
      ${campo("Referência", deal.title)}
      ${campo("Vendedor", deal.responsibleUser?.name)}
      ${campo("Entrega", entrega(deal))}
      ${mostrarValores ? campo("Condição de pagamento", pagamento) : ""}
      ${campo("Validade da proposta", deal.validUntil ? `até ${data(deal.validUntil)}` : "—")}
    </section>

    ${tabelaDeItens(itens, mostrarValores)}
    ${blocoDeTotais(itens, total, mostrarValores)}
    ${observacoes("Observações", deal.notes)}

    <div class="assinaturas">
      <div class="assinatura">${escapar(empresa?.name || "")}</div>
      <div class="assinatura">De acordo — ${escapar(nomeCliente)}<br />Data: ____/____/______</div>
    </div>`;

  return montarDocumento({
    tituloDaAba: `Proposta nº ${numero} — ${nomeCliente}`,
    empresa,
    tipo: "Proposta comercial",
    numero,
    linhasDoNumero: [`Data ${data(new Date())}`],
    corpo,
    rodape: deal.validUntil ? `Proposta válida até ${data(deal.validUntil)}.` : ""
  });
};

export default PropostaService;
