import {
  Table,
  Column,
  DataType,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo,
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
import Deal from "./Deal";
import Customer from "./Customer";
import Contact from "./Contact";
import User from "./User";
import PaymentTerm from "./PaymentTerm";
import OrderItem from "./OrderItem";

const numero = (bruto: unknown): number =>
  bruto === null || bruto === undefined ? 0 : Number(bruto);

/**
 * Pedido.
 *
 * Nasce de um orçamento aprovado, pela ação "Gerar pedido", e guarda tudo o
 * que foi combinado naquele momento: cliente, itens (OrderItems), desconto,
 * condição de pagamento e entrega. Daí em diante produção, documento e
 * cobrança leem daqui, e não do card -- o card de produção só aponta para o
 * pedido (Deal.orderId).
 *
 * A numeração é da empresa e independente da do orçamento; por isso pedido e
 * orçamento são tabelas separadas.
 */
@Table
class Order extends Model<Order> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  /** Número do pedido dentro da empresa: o que o cliente ouve no balcão. */
  @AllowNull(false)
  @Column
  number: number;

  /**
   * Número do orçamento de origem, guardado como número: o orçamento pode ser
   * apagado e o pedido continua tendo que dizer de onde veio.
   */
  @Column
  quoteNumber: number;

  /** Card do orçamento de origem. */
  @ForeignKey(() => Deal)
  @Column
  dealId: number;

  @BelongsTo(() => Deal, "dealId")
  deal: Deal;

  /** Raiz da jornada do card, para juntar orçamento e produção. */
  @ForeignKey(() => Deal)
  @Column
  rootDealId: number;

  @Column
  title: string;

  @ForeignKey(() => Customer)
  @Column
  customerId: number;

  @BelongsTo(() => Customer)
  customer: Customer;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => User)
  @Column
  responsibleUserId: number;

  @BelongsTo(() => User)
  responsibleUser: User;

  /** Soma bruta dos itens. O desconto incide sobre ela (valorLiquidoDoNegocio). */
  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get value(): number {
    return numero(this.getDataValue("value"));
  }

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get discount(): number {
    return numero(this.getDataValue("discount"));
  }

  /** value | percent */
  @Default("value")
  @Column(DataType.STRING(10))
  discountType: string;

  @ForeignKey(() => PaymentTerm)
  @Column
  paymentTermId: number;

  @BelongsTo(() => PaymentTerm)
  paymentTerm: PaymentTerm;

  @Column
  installments: number;

  @Column(DataType.TEXT)
  paymentCondition: string;

  @Column
  deliveryAt: Date;

  @Default(false)
  @Column
  deliveryToArrange: boolean;

  @Column(DataType.STRING(16))
  deliveryMode: string;

  @Column
  carrier: string;

  @Column(DataType.TEXT)
  notes: string;

  /**
   * Situação gravada: open, billed ou canceled. Pago e parcial são
   * calculados das parcelas (ver SituacaoDoPedido), nunca gravados.
   */
  @Default("open")
  @Column(DataType.STRING(16))
  status: string;

  @Column
  approvedAt: Date;

  @Column
  canceledAt: Date;

  @Column
  canceledReason: string;

  @HasMany(() => OrderItem)
  items: OrderItem[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default Order;
