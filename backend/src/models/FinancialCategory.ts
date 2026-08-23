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

/**
 * Categoria de receita ou despesa.
 *
 * É o que transforma "saiu 4.200 este mês" em "saiu 4.200, sendo 2.800 de
 * lona e 900 de tinta". Sem ela o fluxo de caixa mostra o tamanho do buraco
 * mas não onde ele está.
 */
@Table
class FinancialCategory extends Model<FinancialCategory> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column(DataType.STRING(60))
  name: string;

  /** income | expense */
  @AllowNull(false)
  @Column(DataType.STRING(10))
  kind: string;

  @Default(true)
  @Column
  active: boolean;

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

export default FinancialCategory;
