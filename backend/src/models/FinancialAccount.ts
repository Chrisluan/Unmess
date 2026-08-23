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
 * Onde o dinheiro fica: o caixa da loja, a conta do banco, a maquininha.
 *
 * Separar importa porque o saldo de cada uma responde perguntas diferentes --
 * "tem troco na gaveta" não é a mesma pergunta que "dá para pagar o
 * fornecedor sexta".
 */
@Table
class FinancialAccount extends Model<FinancialAccount> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column(DataType.STRING(60))
  name: string;

  /** cash | bank | card */
  @Default("cash")
  @Column(DataType.STRING(12))
  kind: string;

  /**
   * Saldo de onde a conta parte.
   *
   * Sem ele o caixa começaria em zero no dia em que o sistema entrou,
   * ignorando o dinheiro que já existia -- e todo saldo calculado sairia
   * errado pelo mesmo valor, para sempre.
   */
  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get openingBalance(): number {
    const bruto = this.getDataValue("openingBalance");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

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

export default FinancialAccount;
