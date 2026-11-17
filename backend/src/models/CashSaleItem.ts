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
  BelongsTo
} from "sequelize-typescript";

import Company from "./Company";
import Product from "./Product";
import CashSale from "./CashSale";

/**
 * Uma linha do cupom.
 *
 * O nome e o preço são copiados do produto, e não lidos por join. Produto sai
 * de linha, muda de preço, é desativado — e o cupom de ontem precisa continuar
 * dizendo o que dizia ontem. O `productId` fica para relatório de giro, e
 * aceita nulo justamente porque o produto pode ter sumido depois.
 */
@Table({ tableName: "CashSaleItems" })
class CashSaleItem extends Model<CashSaleItem> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  name: string;

  @Default(1)
  @Column(DataType.DECIMAL(12, 3))
  get quantity(): number {
    const bruto = this.getDataValue("quantity");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get unitPrice(): number {
    const bruto = this.getDataValue("unitPrice");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get total(): number {
    const bruto = this.getDataValue("total");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @ForeignKey(() => CashSale)
  @AllowNull(false)
  @Column
  saleId: number;

  @BelongsTo(() => CashSale)
  sale: CashSale;

  @ForeignKey(() => Product)
  @Column
  productId: number;

  @BelongsTo(() => Product)
  product: Product;

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

export default CashSaleItem;
