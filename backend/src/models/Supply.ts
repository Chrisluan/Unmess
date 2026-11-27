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

/** Unidades em que um insumo é comprado e consumido. */
export const UNIDADES_DE_INSUMO = ["m2", "m", "un", "kg", "l", "h"] as const;

/**
 * Insumo: o que a empresa compra para produzir -- lona, vinil, tinta, ilhós,
 * hora de mão de obra.
 *
 * É a base do preço calculado: o custo de um produto é a soma do que ele
 * consome de cada insumo. Mudar o custo aqui recalcula todo produto que o usa
 * (ver RecalcularPrecosService), mas não toca orçamento já feito -- esses
 * guardam a fotografia do custo do dia.
 */
@Table({ tableName: "Supplies" })
class Supply extends Model<Supply> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Default("un")
  @Column(DataType.STRING(8))
  unit: string;

  /** Custo de uma unidade, em reais. DECIMAL vem do MySQL como texto. */
  @Default(0)
  @Column(DataType.DECIMAL(15, 4))
  get cost(): number {
    const bruto = this.getDataValue("cost");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  /** Perda no processo (refile, emenda, teste de cor), em %. */
  @Default(0)
  @Column(DataType.DECIMAL(5, 2))
  get wastePercent(): number {
    const bruto = this.getDataValue("wastePercent");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  /** Fora de uso é desativado, nunca apagado: produtos e histórico apontam para ele. */
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

export default Supply;
