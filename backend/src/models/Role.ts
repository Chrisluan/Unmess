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
import { ALL_PERMISSIONS, sanitizar, Permission } from "../helpers/permissions/catalog";
import { SLUG_ADMINISTRADOR } from "../helpers/permissions/roleTemplates";

/**
 * Cargo — o único lugar onde mora "o que esta pessoa pode fazer".
 *
 * Antes existiam dois conceitos disputando a mesma pergunta: o campo `profile`
 * do usuário (admin/user/vendedor/...) e os Grupos de Permissão. O profile
 * decidia de verdade — "admin" liberava tudo por um atalho no código — e os
 * grupos decidiam o resto, então marcar alguém como "vendedor" não restringia
 * absolutamente nada. Agora é um conceito só. O `profile` sobrou apenas para
 * separar o super-admin da plataforma de quem é membro de uma empresa.
 */
@Table({ tableName: "Roles" })
class Role extends Model<Role> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  /**
   * Identificador estável, usado para reconhecer o cargo de sistema. Nulo nos
   * cargos criados pela empresa — daí o tipo precisar ser declarado à mão: o
   * sequelize-typescript não deduz coluna a partir de `string | null`.
   */
  @Column(DataType.STRING(60))
  slug: string | null;

  @Column(DataType.TEXT)
  description: string | null;

  @Default("[]")
  @Column(DataType.TEXT)
  permissions: string;

  /**
   * Cargo criado e mantido pelo sistema. Só o Administrador é assim: não pode
   * ser editado, renomeado nem excluído, e a empresa sempre tem exatamente um.
   * Sem isso, bastaria um clique errado para a empresa ficar sem ninguém capaz
   * de conceder permissão a ninguém.
   */
  @Default(false)
  @Column
  isSystem: boolean;

  @ForeignKey(() => Company)
  @AllowNull(false)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => User)
  users: User[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  /** É o cargo de Administrador da empresa? */
  get ehAdministrador(): boolean {
    return this.isSystem && this.slug === SLUG_ADMINISTRADOR;
  }

  /**
   * As permissões do cargo, já limpas contra o catálogo atual.
   *
   * O Administrador não lê a coluna: recebe o catálogo inteiro em tempo de
   * execução. É o que garante que uma permissão criada amanhã já nasça na mão
   * de quem administra — antes, a lista ficava congelada no banco no dia em
   * que o grupo foi salvo, e módulos novos apareciam bloqueados para todos.
   */
  get permissionsList(): Permission[] {
    if (this.ehAdministrador) return [...ALL_PERMISSIONS];
    try {
      return sanitizar(JSON.parse(this.getDataValue("permissions") || "[]"));
    } catch (err) {
      // JSON corrompido vira cargo sem permissão nenhuma, e não cargo com
      // todas: quando a leitura falha, o lado seguro do erro é negar.
      return [];
    }
  }

  set permissionsList(value: Permission[]) {
    this.setDataValue("permissions", JSON.stringify(sanitizar(value)));
  }
}

export default Role;
