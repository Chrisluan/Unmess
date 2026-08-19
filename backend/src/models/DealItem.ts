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
    const bruto = this.quantity * this.unitPrice - this.discount;
    return Number(Math.max(0, bruto).toFixed(2));
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

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default DealItem;
