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
import Product from "./Product";
import { calcularItem } from "../helpers/CalcularItem";

/**
 * Item de um negócio: uma linha do orçamento ou da ordem de serviço.
 *
 * É o que dá origem ao valor do negócio. O total do Deal passa a ser a soma
 * destes itens, e não mais um número digitado -- o que permite emitir uma
 * ordem de serviço que confere com o que foi combinado.
 */
@Table
class DealItem extends Model<DealItem> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  description: string;

  /**
   * Os três getters abaixo existem pelo mesmo motivo: o MySQL devolve DECIMAL
   * como string, e sem a conversão uma soma no JavaScript viraria concatenação
   * ("10" + "5" = "105"). Converter aqui evita ter que lembrar disso em cada
   * lugar que lê o item.
   */
  @Default(1)
  @Column(DataType.DECIMAL(12, 3))
  get quantity(): number {
    const bruto = this.getDataValue("quantity");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Default("un")
  @Column(DataType.STRING(12))
  unit: string;

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get unitPrice(): number {
    const bruto = this.getDataValue("unitPrice");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get discount(): number {
    const bruto = this.getDataValue("discount");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  /**
   * Medidas da peça, em metros.
   *
   * No modo linear a largura guarda o comprimento: é o campo que se
   * preenche ao orçar uma faixa de 8 metros, e pedir altura ali confundiria.
   */
  @Default(0)
  @Column(DataType.DECIMAL(10, 3))
  get width(): number {
    const bruto = this.getDataValue("width");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Default(0)
  @Column(DataType.DECIMAL(10, 3))
  get height(): number {
    const bruto = this.getDataValue("height");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  /** unit | area | linear — copiado do produto ao orçar. */
  @Default("unit")
  @Column(DataType.STRING(10))
  pricingMode: string;

  /** Mínimo cobrado por peça, na unidade do modo. */
  @Default(0)
  @Column(DataType.DECIMAL(10, 3))
  get minMeasure(): number {
    const bruto = this.getDataValue("minMeasure");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Column(DataType.TEXT)
  notes: string;

  @Default(0)
  @Column
  position: number;

  /**
   * Total da linha, calculado e nunca gravado.
   *
   * Guardar o total seria criar uma segunda fonte de verdade: bastaria alguém
   * alterar a quantidade por fora para o pedido passar a mostrar dois números
   * que não se explicam.
   */
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

  @ForeignKey(() => Deal)
  @Column
  dealId: number;

  @BelongsTo(() => Deal)
  deal: Deal;

  /**
   * Produto do catálogo, quando o item veio de lá.
   *
   * Descrição e preço continuam gravados no item, e não lidos do produto:
   * o que o cliente aprovou foi o preço daquele dia, e um reajuste no
   * catálogo não pode reescrever orçamento fechado.
   */
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

export default DealItem;
