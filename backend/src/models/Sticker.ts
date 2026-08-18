import {
  Table,
  Column,
  DataType,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  Default
} from "sequelize-typescript";
import Company from "./Company";

@Table
class Sticker extends Model<Sticker> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING)
  name: string;

  /**
   * Caminho relativo do arquivo, no mesmo padrão de Message.mediaUrl: o
   * endereço absoluto é montado pelo frontend a partir do host por onde ele
   * mesmo alcançou a API. Guardar a URL completa prenderia a figurinha a um
   * único endereço, e esta instalação é acessada pela rede local, pelo túnel e
   * por localhost.
   */
  @Column(DataType.STRING)
  get fileName(): string | null {
    const arquivo = this.getDataValue("fileName");
    return arquivo ? `/public/${arquivo}` : null;
  }

  @Default(false)
  @Column
  animated: boolean;

  @Default(0)
  @Column
  size: number;

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

export default Sticker;
