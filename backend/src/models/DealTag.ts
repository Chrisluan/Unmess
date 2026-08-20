import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";
import Deal from "./Deal";
import Tag from "./Tag";

/**
 * Etiquetas de uma oportunidade.
 *
 * Aponta para a mesma tabela de etiquetas já usada nas conversas, em vez de
 * criar um catálogo próprio: "VIP" na conversa e "VIP" na venda são a mesma
 * coisa, e duas listas separadas divergiriam na primeira semana.
 */
@Table({ tableName: "DealTags" })
class DealTag extends Model<DealTag> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Deal)
  @Column
  dealId: number;

  @ForeignKey(() => Tag)
  @Column
  tagId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default DealTag;
