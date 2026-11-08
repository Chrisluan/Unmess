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
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";

import Company from "./Company";
import User from "./User";
import CashSession from "./CashSession";
import FinancialEntry from "./FinancialEntry";

/**
 * Sangria e suprimento: dinheiro que entra ou sai da gaveta sem ser venda.
 *
 * Suprimento é o troco que se coloca no caixa para começar o dia ou repor o
 * que acabou. Sangria é a retirada — para o cofre, para o banco, para pagar o
 * motoboy.
 *
 * Cada movimento tem um lançamento financeiro atrás dele (`entryId`), marcado
 * como transferência. Sem o lançamento, o saldo da conta "Caixa" cresceria
 * para sempre e nunca bateria com a gaveta; sem a marca de transferência, as
 * sangrias do mês apareceriam nas métricas como despesa e o resultado sairia
 * negativo por dinheiro que nunca saiu da empresa.
 */
@Table({ tableName: "CashMovements" })
class CashMovement extends Model<CashMovement> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  /** in = suprimento, out = sangria. */
  @AllowNull(false)
  @Column(DataType.STRING(4))
  direction: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(15, 2))
  get amount(): number {
    const bruto = this.getDataValue("amount");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  /** Obrigatório: sangria sem motivo é dinheiro sumido com carimbo. */
  @AllowNull(false)
  @Column(DataType.STRING(255))
  reason: string;

  @ForeignKey(() => CashSession)
  @AllowNull(false)
  @Column
  sessionId: number;

  @BelongsTo(() => CashSession)
  session: CashSession;

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

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CashMovement;
