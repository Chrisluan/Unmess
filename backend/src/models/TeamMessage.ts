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
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";
import TeamChannel from "./TeamChannel";
import User from "./User";

/** Uma mensagem de texto do chat de equipe. */
@Table
class TeamMessage extends Model<TeamMessage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @ForeignKey(() => TeamChannel)
  @AllowNull(false)
  @Column
  channelId: number;

  @BelongsTo(() => TeamChannel)
  channel: TeamChannel;

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  userId: number | null;

  @BelongsTo(() => User)
  user: User;

  @AllowNull(false)
  @Column(DataType.TEXT)
  body: string;

  @Column(DataType.DATE)
  editedAt: Date | null;

  @Column(DataType.DATE)
  deletedAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default TeamMessage;
