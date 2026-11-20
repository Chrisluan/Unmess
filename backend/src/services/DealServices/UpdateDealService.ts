import AppError from "../../errors/AppError";
import Deal from "../../models/Deal";
import Customer from "../../models/Customer";
import Contact from "../../models/Contact";
import User from "../../models/User";
import PaymentTerm from "../../models/PaymentTerm";
import { pedidoAtivoDo } from "../OrderServices/GerarPedidoService";
import ShowDealService from "./ShowDealService";

interface DealData {
  title?: string;
  value?: number;
  expectedCloseAt?: Date;
  notes?: string;
  customerId?: number;
  contactId?: number;
  responsibleUserId?: number;
  lostReason?: string;
  // Campos da proposta comercial -- ver o modelo Deal.
  deliveryAt?: Date | null;
  deliveryToArrange?: boolean;
  deliveryMode?: string;
  carrier?: string;
  paymentCondition?: string;
  installments?: number;
  discount?: number;
  discountType?: string;
  origin?: string;
  paymentTermId?: number | null;
  validUntil?: Date | null;
}

const CAMPOS_EDITAVEIS: (keyof DealData)[] = [
  "title",
  "value",
  "expectedCloseAt",
  "notes",
  "customerId",
  "contactId",
  "responsibleUserId",
  "lostReason",
  "deliveryAt",
  "deliveryToArrange",
  "deliveryMode",
  "carrier",
  "paymentCondition",
  "installments",
  "discount",
  "discountType",
  "origin",
  "paymentTermId",
  "validUntil"
];

/**
 * O que o pedido congela. Orçamento que já virou pedido não muda nestes
 * campos: o que vale é o que está no pedido, e mudar aqui faria os dois
 * documentos dizerem coisas diferentes.
 */
const CAMPOS_DO_PEDIDO: (keyof DealData)[] = [
  "value",
  "discount",
  "discountType",
  "paymentCondition",
  "installments",
  "paymentTermId",
  "customerId"
];

/**
 * Cliente, contato e responsável têm de ser da mesma empresa do card. Sem
 * isso um id de outro cliente do SaaS era aceito e o card passava a exibir
 * dados de outra empresa.
 */
const garantirMesmaEmpresa = async (
  alteracoes: Record<string, unknown>,
  companyId: number
): Promise<void> => {
  const conferir = async (
    modelo: typeof Customer | typeof Contact | typeof User | typeof PaymentTerm,
    id: unknown,
    erro: string
  ) => {
    if (id === undefined || id === null) return;
    const achado = await (modelo as typeof Customer).findOne({
      where: { id: Number(id), companyId },
      attributes: ["id"]
    });
    if (!achado) throw new AppError(erro, 404);
  };

  await conferir(Customer, alteracoes.customerId, "ERR_NO_CUSTOMER_FOUND");
  await conferir(Contact, alteracoes.contactId, "ERR_NO_CONTACT_FOUND");
  await conferir(User, alteracoes.responsibleUserId, "ERR_NO_USER_FOUND");
  await conferir(PaymentTerm, alteracoes.paymentTermId, "ERR_PAYMENT_TERM_NOT_FOUND");
};

interface Request {
  dealData: DealData;
  dealId: string | number;
  companyId: number;
}

/**
 * Edição dos dados do negócio. A troca de etapa não passa por aqui — ela tem
 * regra própria (ordem, status, registro na timeline) em MoveDealService.
 */
const UpdateDealService = async ({
  dealData,
  dealId,
  companyId
}: Request): Promise<Deal> => {
  const deal = await Deal.findOne({ where: { id: dealId, companyId } });

  if (!deal) {
    throw new AppError("ERR_NO_DEAL_FOUND", 404);
  }

  // Só os campos editáveis. O corpo inteiro da requisição chegava ao update e
  // dava para reescrever status, wonAt, números de orçamento e pedido, etapa e
  // até a empresa do card. Esses campos têm serviços próprios com regra.
  const alteracoes = CAMPOS_EDITAVEIS.reduce<Record<string, unknown>>(
    (acc, campo) => {
      if (dealData[campo] !== undefined) acc[campo] = dealData[campo];
      return acc;
    },
    {}
  );

  await garantirMesmaEmpresa(alteracoes, companyId);

  const pedido = await pedidoAtivoDo(deal, companyId);
  // Conta só o que muda de fato: a tela da proposta reenvia todos os campos a
  // cada gravação, e recusar um desconto igual ao atual travaria até a troca
  // do título.
  const mudou = (campo: keyof DealData): boolean => {
    const novo = alteracoes[campo];
    if (novo === undefined) return false;
    const atual = deal.get(campo as string) as unknown;
    if (novo === null || atual === null || atual === undefined) {
      return (novo ?? null) !== (atual ?? null);
    }
    const n1 = Number(novo);
    const n2 = Number(atual);
    if (Number.isFinite(n1) && Number.isFinite(n2)) return Math.abs(n1 - n2) > 0.0001;
    return String(novo) !== String(atual);
  };
  if (pedido && CAMPOS_DO_PEDIDO.some(mudou)) {
    throw new AppError("ERR_ORCAMENTO_TRAVADO_POR_PEDIDO", 409, {
      orderId: pedido.id,
      number: pedido.number
    });
  }

  await deal.update(alteracoes);

  return ShowDealService(deal.id, companyId);
};

export default UpdateDealService;
