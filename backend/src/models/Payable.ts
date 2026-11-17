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
import Supplier from "./Supplier";
import FinancialCategory from "./FinancialCategory";
import FinancialEntry from "./FinancialEntry";

/**
 * Uma parcela a pagar.
 *
 * Espelho de `Receivable`, de propósito: mesmas colunas, mesma dedução de
 * situação, mesmo cancelamento explícito. Inventar uma estrutura diferente
 * para o mesmo problema custaria duas regras de arredondamento, duas noções de
 * "quitado" e o dobro de lugares para errar.
 *
 * Como lá, o status não é gravado -- ele sai da comparação entre o valor e o
 * que já foi baixado.
 */
@Table
class Payable extends Model<Payable> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  description: string;

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

  /** Nota do fornecedor, boleto, contrato — cada um numera do seu jeito. */
  @Column(DataType.STRING(60))
  document: string;

  @Column
  canceledAt: Date;

  @Column
  canceledReason: string;

  @Column(DataType.TEXT)
  notes: string;

  /** Quanto já foi pago. Ver a nota equivalente em Receivable. */
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
    if (pago >= this.amount - 0.005) return "paid";
    return pago > 0 ? "partial" : "open";
  }

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Supplier)
  @Column
  supplierId: number;

  @BelongsTo(() => Supplier)
  supplier: Supplier;

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

export default Payable;
