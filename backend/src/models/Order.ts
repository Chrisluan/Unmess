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
import Deal from "./Deal";

/**
 * Pedido.
 *
 * Enquanto o card está no funil de vendas ele é um orçamento, com numeração de
 * orçamento. Ao sair do funil vira pedido, e o pedido é registrado aqui, com
 * numeração própria da empresa -- por isso as duas coisas são tabelas
 * separadas: contadores independentes não caberiam numa coluna só.
 */
@Table
class Order extends Model<Order> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  /**
   * Número do pedido dentro da empresa. Diferente do id: o id identifica a
   * linha no banco, este é o número que o cliente ouve no balcão.
   */
  @AllowNull(false)
  @Column
  number: number;

  /**
   * De qual orçamento este pedido nasceu.
   *
   * Guardado como número, e não como referência: o orçamento pode ser apagado,
   * e o pedido continua tendo que dizer de onde veio.
   */
  @Column
  quoteNumber: number;

  @ForeignKey(() => Deal)
  @Column
  dealId: number;

  @BelongsTo(() => Deal)
  deal: Deal;

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get value(): number {
    const bruto = this.getDataValue("value");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Default("open")
  @Column(DataType.STRING(16))
  status: string;

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

export default Order;
