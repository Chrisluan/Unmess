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
import Customer from "./Customer";
import Deal from "./Deal";
import Order from "./Order";
import PaymentTerm from "./PaymentTerm";
import FinancialCategory from "./FinancialCategory";
import FinancialEntry from "./FinancialEntry";

/**
 * Uma parcela a receber.
 *
 * Uma linha por parcela, e não uma linha por pedido com um contador dentro:
 * cada parcela vence num dia, é baixada num dia e pode ser cancelada sozinha.
 *
 * **O status não é gravado.** "Em aberto", "parcial" e "quitada" saem da
 * comparação entre o valor e o que já foi baixado. Gravá-lo criaria uma
 * segunda fonte de verdade, que diverge no instante em que alguém estornar um
 * pagamento e ninguém lembrar de reescrever a coluna. Só o cancelamento tem
 * campo próprio, porque é decisão de gente e não se deduz de valor nenhum.
 */
@Table
class Receivable extends Model<Receivable> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  description: string;

  /** Posição desta parcela e o total delas: "2/3" na tela. */
  @Default(1)
  @Column
  installment: number;

  @Default(1)
  @Column
  installments: number;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  dueDate: string;

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get amount(): number {
    const bruto = this.getDataValue("amount");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  /** Cancelada não é o mesmo que quitada: some da cobrança, some do a receber. */
  @Column
  canceledAt: Date;

  @Column
  canceledReason: string;

  @Column(DataType.TEXT)
  notes: string;

  /**
   * Quanto já foi baixado.
   *
   * Duas origens, nesta ordem. A listagem agrega a soma no banco e a entrega
   * como `paidAmount` — é o caminho que aguenta uma parcela com dezenas de
   * recebimentos parciais sem carregar todos. Fora dela, soma as baixas que
   * vieram junto.
   *
   * Sem nenhuma das duas devolve zero, e não um número inventado.
   */
  get paidAmount(): number {
    const agregado = this.getDataValue("paidAmount" as never);

    if (agregado !== undefined && agregado !== null) return Number(agregado);

    const baixas = this.entries;
    if (!Array.isArray(baixas)) return 0;
    return baixas.reduce((soma, baixa) => soma + Number(baixa.amount || 0), 0);
  }

  /** open | partial | paid | canceled — deduzido, nunca gravado. */
  get status(): string {
    if (this.canceledAt) return "canceled";

    const pago = this.paidAmount;
    // Centavo de tolerância: arredondamento de parcela não pode deixar uma
    // cobrança eternamente "quase quitada".
    if (pago >= this.amount - 0.005) return "paid";
    return pago > 0 ? "partial" : "open";
  }

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  /**
   * De onde a cobrança nasceu.
   *
   * Nulo é possível de propósito: uma venda de balcão não passa pelo quadro, e
   * o financeiro precisa registrá-la mesmo assim.
   */
  @ForeignKey(() => Deal)
  @Column
  dealId: number;

  @BelongsTo(() => Deal)
  deal: Deal;

  @ForeignKey(() => Order)
  @Column
  orderId: number;

  @BelongsTo(() => Order)
  order: Order;

  @ForeignKey(() => Customer)
  @Column
  customerId: number;

  @BelongsTo(() => Customer)
  customer: Customer;

  @ForeignKey(() => PaymentTerm)
  @Column
  paymentTermId: number;

  @BelongsTo(() => PaymentTerm)
  paymentTerm: PaymentTerm;

  @ForeignKey(() => FinancialCategory)
  @Column
  categoryId: number;

  @BelongsTo(() => FinancialCategory)
  category: FinancialCategory;

  @HasMany(() => FinancialEntry)
  entries: FinancialEntry[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default Receivable;
