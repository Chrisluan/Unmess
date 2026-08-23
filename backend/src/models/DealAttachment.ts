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
import User from "./User";

/**
 * Material do pedido: a arte, o arquivo de impressão, a foto de referência.
 *
 * O texto do pedido não diz o que vai ser produzido -- "banner 3x1" pode ser
 * qualquer coisa. Quem está na Produção precisa ver, e o material vivia solto
 * no meio da conversa de WhatsApp, encontrável só rolando o histórico.
 */
@Table
class DealAttachment extends Model<DealAttachment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  /** Nome que a pessoa reconhece, preservado do arquivo original. */
  @AllowNull(false)
  @Column
  name: string;

  /**
   * Caminho relativo do arquivo, no mesmo padrão de Message.mediaUrl: o
   * endereço absoluto é montado pelo frontend a partir do host por onde ele
   * mesmo alcançou a API. Guardar a URL completa prenderia o material a um
   * único endereço, e esta instalação é acessada pela rede local, pelo túnel e
   * por localhost.
   */
  @AllowNull(false)
  @Column(DataType.STRING)
  get fileName(): string | null {
    const arquivo = this.getDataValue("fileName");
    return arquivo ? `/public/${arquivo}` : null;
  }

  @Default("application/octet-stream")
  @Column(DataType.STRING(120))
  mimetype: string;

  @Default(0)
  @Column
  size: number;

  /**
   * A arte que representa o pedido no card do Kanban.
   *
   * Um pedido reúne vários arquivos -- a arte final, o comprovante, a
   * referência que o cliente mandou. Só um responde "o que é este trabalho" de
   * relance, e é esse que vira a capa.
   */
  @Default(false)
  @Column
  isPreview: boolean;

  /** Procedência: de qual mensagem da conversa este arquivo foi trazido. */
  @Column
  sourceMessageId: string;

  /** Verdadeiro para o que o navegador consegue mostrar como miniatura. */
  get isImage(): boolean {
    return String(this.mimetype || "").startsWith("image/");
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

  @ForeignKey(() => User)
  @Column
  uploadedByUserId: number;

  @BelongsTo(() => User)
  uploadedBy: User;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default DealAttachment;
