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
import Company from "./Company";
import Contact from "./Contact";
import User from "./User";

@Table
class Customer extends Model<Customer> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Column
  tradeName: string;

  @AllowNull(false)
  @Default("PJ")
  @Column
  personType: string;

  @Column
  document: string;

  @Column
  stateRegistration: string;

  @Column
  email: string;

  @Column
  phone: string;

  @Column
  whatsapp: string;

  @Column
  zipCode: string;

  @Column
  street: string;

  @Column
  addressNumber: string;

  @Column
  complement: string;

  @Column
  neighborhood: string;

  @Column
  city: string;

  @Column
  state: string;

  @Column
  segment: string;

  @Column
  origin: string;

  @AllowNull(false)
  @Default("lead")
  @Column
  status: string;

  @Column
  notes: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => User)
  @Column
  responsibleUserId: number;

  @BelongsTo(() => User)
  responsibleUser: User;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default Customer;
