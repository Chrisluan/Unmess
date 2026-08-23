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
  BelongsTo
} from "sequelize-typescript";
import Company from "./Company";

/**
 * Fornecedor.
 *
 * Existe pelo mesmo motivo que o catálogo de produtos existe: sem cadastro,
 * "Gráfica Central" e "grafica central" são dois fornecedores para o sistema,
 * e não há como saber quanto se gasta com cada um.
 */
@Table
class Supplier extends Model<Supplier> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Column(DataType.STRING(24))
  document: string;

  @Column(DataType.STRING(24))
  phone: string;

  @Column
  email: string;

  @Column(DataType.TEXT)
  notes: string;

  /** Desativar em vez de excluir: as contas antigas apontam para cá. */
  @Default(true)
  @Column
  active: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default Supplier;
