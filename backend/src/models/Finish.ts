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
 * Sobre o que o acabamento é cobrado, por peça:
 * - area: m² da peça (laminação);
 * - perimetro: metros de contorno (bainha, ilhós a cada 50 cm);
 * - linear: o comprimento (faixa);
 * - unidade: um por peça (instalação de suporte);
 * - fixo: uma vez por item, qualquer que seja a quantidade (arte).
 */
export const BASES_DE_ACABAMENTO = ["area", "perimetro", "linear", "unidade", "fixo"] as const;

const decimal = (bruto: unknown): number =>
  bruto === null || bruto === undefined ? 0 : Number(bruto);

/**
 * Acabamento: o serviço que se soma ao produto -- ilhós, bainha, laminação,
 * refile, instalação.
 *
 * Tem custo e preço. O preço é calculado pelo markup da empresa (padrão) ou
 * digitado (`priceMode = manual`), e o mínimo existe porque um ilhós num
 * adesivo de 10 cm não pode sair por centavos.
 */
@Table({ tableName: "Finishes" })
class Finish extends Model<Finish> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Default("unidade")
  @Column(DataType.STRING(12))
  base: string;

  @Default(0)
  @Column(DataType.DECIMAL(15, 4))
  get cost(): number {
    return decimal(this.getDataValue("cost"));
  }

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get minCost(): number {
    return decimal(this.getDataValue("minCost"));
  }

  @Default("calculado")
  @Column(DataType.STRING(10))
  priceMode: string;

  @Default(0)
  @Column(DataType.DECIMAL(15, 4))
  get price(): number {
    return decimal(this.getDataValue("price"));
  }

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get minPrice(): number {
    return decimal(this.getDataValue("minPrice"));
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

export default Finish;
