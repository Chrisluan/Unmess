import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo,
  BelongsToMany
} from "sequelize-typescript";
import Company from "./Company";
import Ticket from "./Ticket";
import TicketTag from "./TicketTag";

@Table
class Tag extends Model<Tag> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Default("#2ecc71")
  @Column
  color: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @BelongsToMany(() => Ticket, () => TicketTag)
  tickets: Ticket[];
}

export default Tag;
