import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  BeforeCreate,
  BeforeUpdate,
  PrimaryKey,
  AutoIncrement,
  Default,
  HasMany,
  BelongsToMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import { hash, compare } from "bcryptjs";
import Ticket from "./Ticket";
import Queue from "./Queue";
import UserQueue from "./UserQueue";
import Whatsapp from "./Whatsapp";
import Company from "./Company";
import Role from "./Role";

@Table
class User extends Model<User> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Column
  email: string;

  @Column(DataType.VIRTUAL)
  password: string;

  @Column
  passwordHash: string;

  @Default(0)
  @Column
  tokenVersion: number;

  /**
   * Separa o super-admin da plataforma ("super") de quem é membro de uma
   * empresa ("member"). Não decide mais permissão nenhuma — isso é do cargo.
   *
   * O padrão era "admin", o que fazia todo usuário criado sem profile
   * explícito nascer com acesso total: o pior lugar possível para um valor
   * padrão generoso. Agora o padrão não concede nada por si só.
   */
  @Default("member")
  @Column
  profile: string;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Role)
  @Column
  roleId: number;

  @BelongsTo(() => Role)
  role: Role;

  /**
   * Exceções individuais, aplicadas por cima do cargo:
   * { "allow": ["finance:view"], "deny": ["tickets:delete"] }
   *
   * São a válvula de escape para o caso de uma pessoa só, para não obrigar a
   * criar um cargo inteiro por causa de uma permissão. A tela as mostra como
   * duas listas nomeadas — antes eram um checkbox de quatro estados em que
   * "indeterminado" queria dizer "bloqueado".
   */
  @Column(DataType.TEXT)
  accessExceptions: string;

  // Teto de chats abertos simultâneos. 0 = sem limite.
  @Default(0)
  @Column
  maxSimultaneousTickets: number;

  // Presença do atendente, mantida pelo socket (conectar/desconectar).
  @Default(false)
  @Column
  online: boolean;

  @Column
  lastSeenAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @BelongsToMany(() => Queue, () => UserQueue)
  queues: Queue[];

  @BeforeUpdate
  @BeforeCreate
  static hashPassword = async (instance: User): Promise<void> => {
    if (instance.password) {
      // Custo 12 em vez de 8: cada ponto dobra o trabalho de conferir a senha,
      // e o que aqui custa alguns décimos de segundo no login multiplica por
      // bilhões o custo de quem tentar quebrar os hashes com um vazamento do
      // banco na mão. Senhas já gravadas continuam válidas -- o bcrypt guarda
      // o custo dentro do próprio hash --, e migram para 12 na próxima troca.
      instance.passwordHash = await hash(instance.password, 12);
    }
  };

  public checkPassword = async (password: string): Promise<boolean> => {
    return compare(password, this.getDataValue("passwordHash"));
  };
}

export default User;
