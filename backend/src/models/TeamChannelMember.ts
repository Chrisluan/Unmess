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
  BelongsTo
} from "sequelize-typescript";
import TeamChannel from "./TeamChannel";
import User from "./User";

/**
 * Quem participa de um canal e até onde leu.
 *
 * Na conversa a dois a linha é a própria participação: sem ela, a pessoa não
 * enxerga a conversa. Nos canais abertos ela só guarda a leitura, e nasce na
 * primeira vez que a pessoa abre o canal.
 */
@Table
class TeamChannelMember extends Model<TeamChannelMember> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => TeamChannel)
  @AllowNull(false)
  @Column
  channelId: number;

  @BelongsTo(() => TeamChannel)
  channel: TeamChannel;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Default(0)
  @Column
  lastReadMessageId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default TeamChannelMember;
