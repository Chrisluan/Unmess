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
import User from "./User";
import FinancialAccount from "./FinancialAccount";
import FinancialCategory from "./FinancialCategory";
import Receivable from "./Receivable";
import Payable from "./Payable";

/**
 * Movimento de dinheiro — a única tabela onde o dinheiro se mexe.
 *
 * Serve de baixa de uma conta a receber, de baixa de uma conta a pagar e de
 * lançamento avulso: uma retirada do dono, um aporte, uma tarifa do banco. O fluxo de caixa é a soma daqui; não há outro lugar de onde
 * um saldo possa sair, e é isso que impede dois números diferentes para o
 * mesmo dia.
 */
@Table
class FinancialEntry extends Model<FinancialEntry> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  /** in | out */
  @AllowNull(false)
  @Column(DataType.STRING(4))
  direction: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(15, 2))
  get amount(): number {
    const bruto = this.getDataValue("amount");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  /**
   * Quando o dinheiro se moveu — que não é quando alguém digitou.
   *
   * Um recebimento lançado na segunda pode ter acontecido no sábado, e é o
   * sábado que o caixa daquele dia precisa mostrar. Usar a data do registro
   * jogaria o fim de semana inteiro para dentro da segunda.
   */
  @AllowNull(false)
  @Column(DataType.DATEONLY)
  occurredAt: string;

  /** cash | pix | debit | credit | boleto | transfer | check | other */
  @Default("cash")
  @Column(DataType.STRING(12))
  method: string;

  @Column
  description: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => FinancialAccount)
  @AllowNull(false)
  @Column
  accountId: number;

  @BelongsTo(() => FinancialAccount)
  account: FinancialAccount;

  /**
   * A parcela que esta baixa quita — a receber ou a pagar.
   *
   * Os dois são nulos num lançamento avulso (uma retirada, uma tarifa), e
   * nunca preenchidos ao mesmo tempo: uma baixa quita uma coisa só.
   */
  @ForeignKey(() => Receivable)
  @Column
  receivableId: number;

  @BelongsTo(() => Receivable)
  receivable: Receivable;

  @ForeignKey(() => Payable)
  @Column
  payableId: number;

  @BelongsTo(() => Payable)
  payable: Payable;

  @ForeignKey(() => FinancialCategory)
  @Column
  categoryId: number;

  @BelongsTo(() => FinancialCategory)
  category: FinancialCategory;

  /** Quem lançou. Baixa de dinheiro sem autor não se audita. */
  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default FinancialEntry;
