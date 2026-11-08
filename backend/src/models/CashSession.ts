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
import FinancialAccount from "./FinancialAccount";
import CashMovement from "./CashMovement";

/**
 * Um turno de caixa: de quando abriu até quando fechou.
 *
 * O caixa em si não é entidade própria — é a conta financeira de tipo "cash".
 * O que a sessão acrescenta é o recorte de tempo e de responsável, que é o que
 * torna possível a pergunta que se faz no fim do dia: quanto deveria ter aqui
 * dentro, e quanto tem.
 *
 * Só existe uma sessão aberta por caixa, e quem garante isso é um índice único
 * no banco, não uma conferência antes da inserção — dois cliques no botão de
 * abrir abririam dois turnos, e a partir dali toda venda cairia num deles sem
 * critério.
 */
@Table({ tableName: "CashSessions" })
class CashSession extends Model<CashSession> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  /** open | closed */
  @Default("open")
  @AllowNull(false)
  @Column(DataType.STRING(10))
  status: string;

  @AllowNull(false)
  @Column
  openedAt: Date;

  /** O troco que estava na gaveta quando o turno começou. */
  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get openingAmount(): number {
    const bruto = this.getDataValue("openingAmount");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Column
  closedAt: Date;

  /** O que foi contado na gaveta ao fechar. */
  @Column(DataType.DECIMAL(15, 2))
  get closingAmount(): number | null {
    const bruto = this.getDataValue("closingAmount");
    return bruto === null || bruto === undefined ? null : Number(bruto);
  }

  /**
   * O que o sistema esperava encontrar, congelado no momento do fechamento.
   *
   * Guardado, e não recalculado na leitura: um lançamento estornado meses
   * depois mudaria a conta e faria a diferença de um turno antigo aparecer
   * diferente do que foi assinado no dia.
   */
  @Column(DataType.DECIMAL(15, 2))
  get expectedAmount(): number | null {
    const bruto = this.getDataValue("expectedAmount");
    return bruto === null || bruto === undefined ? null : Number(bruto);
  }

  /** Contado − esperado. Positivo é sobra, negativo é falta. */
  @Column(DataType.DECIMAL(15, 2))
  get difference(): number | null {
    const bruto = this.getDataValue("difference");
    return bruto === null || bruto === undefined ? null : Number(bruto);
  }

  @Column(DataType.TEXT)
  notes: string;

  @ForeignKey(() => FinancialAccount)
  @AllowNull(false)
  @Column
  accountId: number;

  @BelongsTo(() => FinancialAccount)
  account: FinancialAccount;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  openedById: number;

  @BelongsTo(() => User, "openedById")
  openedBy: User;

  @ForeignKey(() => User)
  @Column
  closedById: number;

  @BelongsTo(() => User, "closedById")
  closedBy: User;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => CashMovement)
  movements: CashMovement[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default CashSession;
