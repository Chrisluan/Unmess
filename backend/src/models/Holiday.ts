import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  DataType,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";

/**
 * Feriado / exceção no horário de atendimento.
 *
 * `recurring` = true para datas fixas todo ano (Natal, por exemplo): nesse
 * caso só dia e mês importam.
 */
@Table
class Holiday extends Model<Holiday> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  date: string;

  @Default(false)
  @Column
  recurring: boolean;

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

export default Holiday;
