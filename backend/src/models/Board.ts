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
  BelongsTo,
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
import PipelineStage from "./PipelineStage";

/**
 * Quadro do CRM — um estágio do processo da empresa (Funil de Vendas,
 * Produção, Expedição, Financeiro...).
 *
 * Os quadros formam uma fila: o `order` define quem vem depois de quem. Quando
 * um card chega na coluna marcada como final, ele avança para o primeiro
 * quadro seguinte nessa ordem. O último quadro da fila é o que encerra a venda
 * como faturada.
 */
@Table
class Board extends Model<Board> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Default("#2576d2")
  @Column
  color: string;

  // Posição do quadro na fila (0 = primeiro).
  @Default(0)
  @Column
  order: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  /**
   * A chave é declarada explicitamente porque PipelineStage aponta para Board
   * duas vezes — `boardId` (a coluna pertence a este quadro) e `targetBoardId`
   * (a coluna final manda o card para este quadro). Sem dizer qual usar, o
   * Sequelize escolhe sozinho e a lista de colunas volta vazia.
   */
  @HasMany(() => PipelineStage, "boardId")
  stages: PipelineStage[];
}

export default Board;
