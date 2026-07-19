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
  HasMany,
  BeforeCreate,
  BeforeUpdate
} from "sequelize-typescript";
import Company from "./Company";
import User from "./User";

@Table
class PermissionGroup extends Model<PermissionGroup> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Default("[]")
  @Column(DataType.TEXT)
  permissions: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => User)
  users: User[];

  // "permissions" é armazenada como TEXT (JSON string) para compatibilidade
  // com MySQL 5.7/8 sem depender de um tipo JSON nativo específico do
  // dialeto. Os getters/setters abaixo escondem esse detalhe do resto do
  // app, que sempre lida com um array de strings.
  get permissionsList(): string[] {
    try {
      return JSON.parse(this.getDataValue("permissions") || "[]");
    } catch (err) {
      return [];
    }
  }

  set permissionsList(value: string[]) {
    this.setDataValue("permissions", JSON.stringify(value || []));
  }

  @BeforeCreate
  @BeforeUpdate
  static ensureValidJson(instance: PermissionGroup) {
    if (Array.isArray((instance as any).permissions)) {
      instance.setDataValue(
        "permissions",
        JSON.stringify((instance as any).permissions)
      );
    }
  }
}

export default PermissionGroup;
