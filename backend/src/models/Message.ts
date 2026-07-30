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

  @Column(DataType.STRING)
  get mediaUrl(): string | null {
    if (this.getDataValue("mediaUrl")) {
      return `${process.env.BACKEND_URL}:${
        process.env.PROXY_PORT
      }/public/${this.getDataValue("mediaUrl")}`;
    }
    return null;
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
