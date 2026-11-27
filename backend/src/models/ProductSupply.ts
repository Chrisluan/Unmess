import {
  Table,
  Column,
  DataType,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  Default,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
// eslint-disable-next-line import/no-cycle
import Product from "./Product";
import Supply from "./Supply";

/**
 * Uma linha da composição: quanto de um insumo vai em uma unidade de medida
 * do produto. Banner por m²: 1,05 m² de lona, 0,012 l de tinta.
 */
@Table({ tableName: "ProductSupplies" })
class ProductSupply extends Model<ProductSupply> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Product)
  @Column
  productId: number;

  @BelongsTo(() => Product)
  product: Product;

  @ForeignKey(() => Supply)
  @Column
  supplyId: number;

  @BelongsTo(() => Supply)
  supply: Supply;

  @Default(1)
  @Column(DataType.DECIMAL(12, 4))
  get quantity(): number {
    const bruto = this.getDataValue("quantity");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;
}

export default ProductSupply;
