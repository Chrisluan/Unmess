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
import Order from "./Order";
import Product from "./Product";
import { calcularItem } from "../helpers/CalcularItem";

const numero = (bruto: unknown): number =>
  bruto === null || bruto === undefined ? 0 : Number(bruto);

/**
 * Item de um pedido: a cópia congelada de uma linha do orçamento.
 *
 * Nasce quando o pedido é gerado e não acompanha mais o orçamento: o que foi
 * aprovado é o que vai para a produção e para a cobrança. Mexer depois é
 * alterar o pedido (permissão própria), não o orçamento.
 *
 * Mesmas colunas e mesma conta do DealItem, de propósito: o documento do
 * pedido e o do orçamento precisam fechar no mesmo número.
 */
@Table
class OrderItem extends Model<OrderItem> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  description: string;

  // Getters: o MySQL devolve DECIMAL como string, e "10" + "5" vira "105".
  @Default(1)
  @Column(DataType.DECIMAL(12, 3))
  get quantity(): number {
    return numero(this.getDataValue("quantity"));
  }

  @Default("un")
  @Column(DataType.STRING(16))
  unit: string;

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get unitPrice(): number {
    return numero(this.getDataValue("unitPrice"));
  }

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get discount(): number {
    return numero(this.getDataValue("discount"));
  }

  @Default(0)
  @Column(DataType.DECIMAL(10, 3))
  get width(): number {
    return numero(this.getDataValue("width"));
  }

  @Default(0)
  @Column(DataType.DECIMAL(10, 3))
  get height(): number {
    return numero(this.getDataValue("height"));
  }

  @Default("unit")
  @Column(DataType.STRING(10))
  pricingMode: string;

  @Default(0)
  @Column(DataType.DECIMAL(10, 3))
  get minMeasure(): number {
    return numero(this.getDataValue("minMeasure"));
  }

  @Column(DataType.TEXT)
  notes: string;

  @Default(0)
  @Column
  position: number;

  /** Calculado, nunca gravado: a mesma conta do orçamento. */
  get total(): number {
    return calcularItem({
      quantity: this.quantity,
      width: this.width,
      height: this.height,
      unitPrice: this.unitPrice,
      discount: this.discount,
      pricingMode: this.pricingMode,
      minMeasure: this.minMeasure
    }).total;
  }

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Order)
  @Column
  orderId: number;

  @BelongsTo(() => Order)
  order: Order;

  @ForeignKey(() => Product)
  @Column
  productId: number;

  @BelongsTo(() => Product)
  product: Product;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default OrderItem;
