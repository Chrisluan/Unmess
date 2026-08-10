import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  HasMany,
  AutoIncrement,
  Default
} from "sequelize-typescript";

import Contact from "./Contact";
import Message from "./Message";
import Queue from "./Queue";
import User from "./User";
import Whatsapp from "./Whatsapp";
import Company from "./Company";
import TicketStatus from "./TicketStatus";
import Tag from "./Tag";
import TicketTag from "./TicketTag";

@Table
class Ticket extends Model<Ticket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column({ defaultValue: "pending" })
  status: string;

  @Column
  unreadMessages: number;

  @Column
  lastMessage: string;

  @Default(false)
  @Column
  isGroup: boolean;

  // Saudação do setor já enviada neste atendimento — evita repetir a cada
  // mensagem que o cliente manda.
  @Default(false)
  @Column
  greetingSent: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @HasMany(() => Message)
  messages: Message[];

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => TicketStatus)
  @Column
  closingStatusId: number;

  @BelongsTo(() => TicketStatus)
  closingStatus: TicketStatus;

  // Protocolo citável pelo cliente: AAAAMMDD + id com 6 dígitos.
  @Column
  protocol: string;

  @Column
  firstResponseAt: Date;

  @Column
  closedAt: Date;

  @BelongsToMany(() => Tag, () => TicketTag)
  tags: Tag[];
}

export default Ticket;
