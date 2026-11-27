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
  BelongsTo,
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";
import TeamChannelMember from "./TeamChannelMember";

export type TipoDeCanal = "channel" | "direct";

/**
 * Um canal do chat de equipe — texto e rádio na mesma sala.
 *
 * `channel` é aberto a toda a empresa; `direct` é a conversa entre duas
 * pessoas, identificada por `directKey` ("menorId:maiorId").
 */
@Table
class TeamChannel extends Model<TeamChannel> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @Default("channel")
  @Column(DataType.STRING(10))
  kind: TipoDeCanal;

  @Column(DataType.STRING(60))
  name: string | null;

  @Column(DataType.STRING(200))
  topic: string | null;

  @Column(DataType.STRING(40))
  directKey: string | null;

  @Default(0)
  @Column
  position: number;

  @Default(false)
  @Column
  archived: boolean;

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  createdById: number | null;

  @BelongsTo(() => User, "createdById")
  createdBy: User;

  @HasMany(() => TeamChannelMember)
  members: TeamChannelMember[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default TeamChannel;
