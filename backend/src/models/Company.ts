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
  HasMany
} from "sequelize-typescript";
import CompanyInvoice from "./CompanyInvoice";
import User from "./User";
import Whatsapp from "./Whatsapp";
import Contact from "./Contact";
import Ticket from "./Ticket";
import Queue from "./Queue";

@Table
class Company extends Model<Company> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  /**
   * Caminho relativo da logo. O frontend prefixa com o endereço por onde
   * alcançou a API — um endereço absoluto aqui quebraria a imagem para quem
   * acessa pela VPN ou pelo nome da máquina.
   */
  @Column(DataType.STRING)
  get logo(): string | null {
    const arquivo = this.getDataValue("logo");
    return arquivo ? `/public/${arquivo}` : null;
  }

  @Column
  document: string;

  @Column
  email: string;

  @Column
  phone: string;

  @Default("basic")
  @Column
  plan: string;

  @Default("active")
  @Column
  status: string;

  @Column
  dueDate: Date;

  /**
   * Por que o acesso está como está.
   *
   * O status sozinho só diz "suspensa". Quem atende o telefone precisa saber
   * se foi inadimplência, pedido do próprio cliente ou engano — e a tela de
   * login pode devolver o motivo para a pessoa que ficou de fora.
   */
  @Column
  statusReason: string;

  @Column
  statusChangedAt: Date;

  /** Id do cliente no gateway de pagamento. */
  @Column
  billingCustomerId: string;

  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  monthlyFee: number;

  @Default(10)
  @Column
  billingDay: number;

  @Default(false)
  @Column
  blockWhenOverdue: boolean;

  @Default(5)
  @Column
  overdueGraceDays: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => User)
  users: User[];

  @HasMany(() => Whatsapp)
  whatsapps: Whatsapp[];

  @HasMany(() => Contact)
  contacts: Contact[];

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasMany(() => Queue)
  queues: Queue[];

  @HasMany(() => CompanyInvoice)
  invoices: CompanyInvoice[];
}

export default Company;
