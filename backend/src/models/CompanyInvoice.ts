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
  BelongsTo
} from "sequelize-typescript";

import Company from "./Company";

export type InvoiceStatus =
  | "pending"
  | "paid"
  | "overdue"
  | "canceled"
  | "failed";

/**
 * Fatura de uma empresa assinante.
 *
 * Guarda lado a lado o que o sistema controla (valor, vencimento, baixa) e o
 * que o gateway devolveu (linha digitável, PDF, id da cobrança lá). Os dois
 * porque a fatura precisa continuar utilizável quando a API do gateway está
 * fora, e porque cobranças feitas por fora — direto no banco — também moram
 * aqui, com `provider = "manual"`.
 */
@Table({ tableName: "CompanyInvoices" })
class CompanyInvoice extends Model<CompanyInvoice> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull(false)
  @Column
  description: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(15, 2))
  amount: number;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  dueDate: string;

  @Default("pending")
  @Column
  status: InvoiceStatus;

  @Column
  paidAt: Date;

  @Column(DataType.DECIMAL(15, 2))
  paidAmount: number;

  @Default("boleto")
  @Column
  billingType: string;

  @Default("manual")
  @Column
  provider: string;

  @Column
  providerChargeId: string;

  @Column(DataType.STRING(512))
  bankSlipUrl: string;

  @Column(DataType.STRING(80))
  digitableLine: string;

  @Column(DataType.TEXT)
  pixPayload: string;

  @Column(DataType.STRING(512))
  invoiceUrl: string;

  @Column(DataType.STRING(512))
  lastError: string;

  @Column(DataType.TEXT)
  notes: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  /**
   * Vencida é situação, não estado gravado à toa: uma fatura em aberto vira
   * vencida sozinha quando o dia passa, e depender de um job para escrever
   * isso no banco deixaria a tela mentindo entre uma execução e outra.
   */
  get vencida(): boolean {
    if (this.status !== "pending") return false;
    const hoje = new Date().toISOString().slice(0, 10);
    return String(this.dueDate) < hoje;
  }
}

export default CompanyInvoice;
