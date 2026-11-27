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
  BelongsTo,
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
// eslint-disable-next-line import/no-cycle
import ProductSupply from "./ProductSupply";
// eslint-disable-next-line import/no-cycle
import ProductFinish from "./ProductFinish";

/**
 * Produto ou serviço do catálogo.
 *
 * Existe para o item do orçamento parar de ser texto digitado na hora: sem
 * catálogo, "Adesivo impressão digital" e "adesivo imp. digital" são coisas
 * diferentes para o sistema, o preço varia por memória de quem digitou, e não
 * há como saber o que mais se vende.
 */
@Table
class Product extends Model<Product> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  /** Código interno ou de fábrica, para quem procura pelo número. */
  @Column(DataType.STRING(40))
  code: string;

  @Column(DataType.TEXT)
  description: string;

  @Default("un")
  @Column(DataType.STRING(12))
  unit: string;

  /**
   * Os dois getters convertem o DECIMAL que o MySQL devolve como string. Sem
   * isso, somar preços em JavaScript viraria concatenação.
   */
  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get price(): number {
    const bruto = this.getDataValue("price");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get cost(): number {
    const bruto = this.getDataValue("cost");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  /**
   * unit | area | linear — como este produto é cobrado.
   *
   * Banner sai por metro quadrado, faixa por metro linear, letra caixa por
   * peça. Os três convivem no mesmo orçamento porque é assim que o
   * trabalho chega.
   */
  @Default("unit")
  @Column(DataType.STRING(10))
  pricingMode: string;

  /** Mínimo cobrado por peça: sem piso, um adesivo pequeno sai por centavos. */
  @Default(0)
  @Column(DataType.DECIMAL(10, 3))
  get minMeasure(): number {
    const bruto = this.getDataValue("minMeasure");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Column(DataType.STRING(60))
  category: string;

  /**
   * Produto fora de linha é desativado, nunca apagado: os orçamentos antigos
   * apontam para ele, e removê-lo deixaria o histórico com itens órfãos.
   */
  @Default(true)
  @Column
  active: boolean;

  /**
   * manual: preço e custo digitados, como sempre foi.
   * calculado: custo = soma da composição (insumos), preço = custo × markup.
   * Os dois ficam gravados em `cost`/`price` -- recalculados quando a
   * composição, um insumo ou o markup da empresa mudam -- para que o PDV, o
   * catálogo e o orçamento leiam o mesmo número sem refazer a conta.
   */
  @Default("manual")
  @Column(DataType.STRING(10))
  priceMode: string;

  /** Markup (ou lucro) próprio, em %. Nulo = o da empresa. */
  @Column(DataType.DECIMAL(7, 2))
  get markupPercent(): number | null {
    const bruto = this.getDataValue("markupPercent");
    return bruto === null || bruto === undefined ? null : Number(bruto);
  }

  @HasMany(() => ProductSupply)
  composicao: ProductSupply[];

  @HasMany(() => ProductFinish)
  acabamentos: ProductFinish[];

  /** Margem sobre o preço de venda, calculada e nunca gravada. */
  get margin(): number {
    if (!this.price) return 0;
    return Number((((this.price - this.cost) / this.price) * 100).toFixed(1));
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

export default Product;
