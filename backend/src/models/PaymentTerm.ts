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
 * Condição de pagamento — "à vista", "30/60/90", "entrada + 2x".
 *
 * Existe para o prazo deixar de ser texto que só gente lê. O campo livre que
 * havia no negócio guardava coisas como "metade agora, resto na entrega", e
 * nenhuma máquina consegue transformar isso em data de vencimento. Com os
 * prazos declarados, o pedido faturado gera as parcelas sozinho.
 */
@Table
class PaymentTerm extends Model<PaymentTerm> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column(DataType.STRING(60))
  name: string;

  /**
   * Dias de vencimento de cada parcela, contados do faturamento.
   *
   * `[0]` é à vista, `[30,60,90]` é a prazo, `[0,30]` é metade na hora. O
   * tamanho da lista **é** a quantidade de parcelas: guardar o número numa
   * coluna à parte criaria duas fontes para o mesmo fato, que divergem na
   * primeira edição.
   */
  @AllowNull(false)
  @Default([0])
  @Column(DataType.JSON)
  dayOffsets: number[];

  /**
   * Percentual de cada parcela.
   *
   * Nulo divide em partes iguais, que é o caso comum. Declarado permite
   * entrada maior que o resto -- "50/25/25".
   */
  @Column(DataType.JSON)
  percentages: number[] | null;

  /** Desativar em vez de excluir: as cobranças antigas apontam para cá. */
  @Default(true)
  @Column
  active: boolean;

  /** Quantas parcelas esta condição gera. Deduzido, nunca gravado. */
  get installments(): number {
    const prazos = this.getDataValue("dayOffsets");
    return Array.isArray(prazos) && prazos.length ? prazos.length : 1;
  }

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

export default PaymentTerm;
