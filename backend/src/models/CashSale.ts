import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo,
  HasMany
} from "sequelize-typescript";

import Company from "./Company";
import User from "./User";
import Customer from "./Customer";
import Receivable from "./Receivable";
import FinancialEntry from "./FinancialEntry";
import CashSession from "./CashSession";
import CashSaleItem from "./CashSaleItem";

/**
 * Venda de balcão.
 *
 * O cliente que entra pedindo dois adesivos não passa por cotação, aprovação
 * nem produção — e não deve virar card no funil por causa disso. Um quadro
 * cheio de oportunidades que nascem e morrem no mesmo minuto estraga toda
 * métrica de conversão do CRM.
 *
 * O que a venda tem em comum com as do funil é o destino: gera cobrança e
 * lançamento, e por aí chega ao caixa, ao fluxo e às métricas. O que ela não
 * tem é jornada.
 */
@Table({ tableName: "CashSales" })
class CashSale extends Model<CashSale> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  /** Sequencial por empresa, para o cupom ter número. */
  @AllowNull(false)
  @Column
  number: number;

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get total(): number {
    const bruto = this.getDataValue("total");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get discount(): number {
    const bruto = this.getDataValue("discount");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  /** cash | pix | debit | credit | boleto | transfer | check | other */
  @AllowNull(false)
  @Column(DataType.STRING(12))
  method: string;

  @ForeignKey(() => CashSession)
  @AllowNull(false)
  @Column
  sessionId: number;

  @BelongsTo(() => CashSession)
  session: CashSession;

  @ForeignKey(() => Customer)
  @Column
  customerId: number;

  @BelongsTo(() => Customer)
  customer: Customer;

  @ForeignKey(() => Receivable)
  @Column
  receivableId: number;

  @BelongsTo(() => Receivable)
  receivable: Receivable;

  @ForeignKey(() => FinancialEntry)
  @Column
  entryId: number;

  @BelongsTo(() => FinancialEntry)
  entry: FinancialEntry;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => CashSaleItem)
  items: CashSaleItem[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CashSale;
