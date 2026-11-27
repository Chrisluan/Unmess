import {
  Table,
  Column,
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
import Finish from "./Finish";

/** Acabamento que o produto oferece; `isDefault` já vem marcado ao orçar. */
@Table({ tableName: "ProductFinishes" })
class ProductFinish extends Model<ProductFinish> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Product)
  @Column
  productId: number;

  @BelongsTo(() => Product)
  product: Product;

  @ForeignKey(() => Finish)
  @Column
  finishId: number;

  @BelongsTo(() => Finish)
  finish: Finish;

  @Default(false)
  @Column
  isDefault: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;
}

export default ProductFinish;
