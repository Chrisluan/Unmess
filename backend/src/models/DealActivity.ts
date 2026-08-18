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
import Deal from "./Deal";
import User from "./User";

/**
 * Item da linha do tempo de um negócio.
 *
 * Guarda tanto o que a pessoa escreve (nota, tarefa) quanto o que o sistema
 * registra sozinho (mudança de etapa, ganho, perda). Manter os dois na mesma
 * tabela é o que permite mostrar uma timeline única em ordem cronológica.
 */
@Table
class DealActivity extends Model<DealActivity> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  // note | task | stage_change | created | won | lost
  @AllowNull(false)
  @Default("note")
  @Column
  type: string;

  @Column(DataType.TEXT)
  body: string;

  // Só para type "task": quando vence e quando foi concluída.
  @Column
  dueAt: Date;

  @Column
  doneAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Deal)
  @Column
  dealId: number;

  @BelongsTo(() => Deal)
  deal: Deal;

  // Autor. Fica nulo em registros automáticos disparados fora de uma requisição.
  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;
}

export default DealActivity;
