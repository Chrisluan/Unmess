import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  Default,
  BelongsTo,
  ForeignKey
} from "sequelize-typescript";
import Contact from "./Contact";
import Ticket from "./Ticket";
import User from "./User";

@Table
class Message extends Model<Message> {
  @PrimaryKey
  @Column
  id: string;

  @Default(0)
  @Column
  ack: number;

  @Default(false)
  @Column
  read: boolean;

  @Default(false)
  @Column
  fromMe: boolean;

  @Column(DataType.TEXT)
  body: string;

  /**
   * Caminho relativo do anexo. O frontend prefixa com o endereço pelo qual ele
   * mesmo alcançou a API.
   *
   * Antes montava a URL absoluta a partir de BACKEND_URL, o que prendia o
   * anexo a um único endereço: quem entrasse pelo IP da VPN ou pelo nome da
   * máquina recebia links apontando para o IP da rede local, inalcançável dali.
   */
  @Column(DataType.STRING)
  get mediaUrl(): string | null {
    const arquivo = this.getDataValue("mediaUrl");
    return arquivo ? `/public/${arquivo}` : null;
  }

  @Column
  mediaType: string;

  @Default(false)
  @Column
  isDeleted: boolean;

  // Nota interna: aparece na conversa para a equipe, mas nunca é enviada
  // ao contato pelo WhatsApp.
  @Default(false)
  @Column
  isInternal: boolean;

  // Enviada pelo aplicativo do WhatsApp no celular, não por este sistema.
  // Só tem significado quando fromMe é verdadeiro.
  @Default(false)
  @Column
  fromApp: boolean;

  // Texto reescrito depois do envio.
  @Default(false)
  @Column
  isEdited: boolean;

  // Horário real de envio informado pelo WhatsApp. Difere de createdAt quando
  // a mensagem demora a chegar. Nulo nas linhas anteriores à coluna.
  @Column
  timestamp: Date;

  // Autor da nota interna (ou do envio, quando registrado).
  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User, "userId")
  user: User;

  @CreatedAt
  @Column(DataType.DATE(6))
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE(6))
  updatedAt: Date;

  @ForeignKey(() => Message)
  @Column
  quotedMsgId: string;

  @BelongsTo(() => Message, "quotedMsgId")
  quotedMsg: Message;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact, "contactId")
  contact: Contact;
}

export default Message;
