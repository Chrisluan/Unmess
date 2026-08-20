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
import Board from "./Board";
import Deal from "./Deal";

/**
 * Coluna de um quadro do CRM.
 *
 * As marcações que governam o comportamento da coluna:
 *
 * - `isInitial`: porta de entrada do quadro. É onde pousa o card que chega de
 *   outro quadro. Uma por quadro.
 * - `isFinal`: chegar aqui conclui o quadro e manda o card adiante. Um quadro
 *   pode ter várias — "Ganho / produzir", "Ganho / revenda" e "Ganho / serviço"
 *   saem do mesmo funil para destinos diferentes.
 * - `targetBoardId` / `targetStageId`: para onde esta coluna final manda o
 *   card. Sem destino configurado, cai no quadro seguinte da fila; sem quadro
 *   seguinte, a venda é faturada.
 * - `type`: "open" é coluna de trabalho, "lost" encerra o card como perdido.
 *   Perda pode acontecer em qualquer quadro, não só no funil de vendas.
 */
@Table
class PipelineStage extends Model<PipelineStage> {
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

  // Posição da coluna no board, da esquerda para a direita.
  @Default(0)
  @Column
  order: number;

  // open | lost
  @Default("open")
  @Column
  type: string;

  // Porta de entrada do quadro. Só uma por quadro: o card que chega precisa
  // de um destino sem ambiguidade.
  @Default(false)
  @Column
  isInitial: boolean;

  // Conclui o quadro. Pode haver várias por quadro, cada uma com seu destino.
  @Default(false)
  @Column
  isFinal: boolean;

  /** Chance de fechamento nesta etapa; alimenta o valor ponderado do funil. */
  @Default(0)
  @Column
  probability: number;

  /** Ganho explicito, em vez de deduzido de "acabou o funil". */
  @Default(false)
  @Column
  isWon: boolean;

  /** Desativar em vez de excluir preserva o historico de quem passou por aqui. */
  @Default(true)
  @Column
  active: boolean;

  /**
   * Destino desta coluna final. `targetStageId` manda para uma coluna exata;
   * `targetBoardId` sozinho manda para a coluna inicial daquele quadro. Ambos
   * nulos significa "siga a ordem dos quadros".
   */
  @ForeignKey(() => Board)
  @Column
  targetBoardId: number;

  @BelongsTo(() => Board, "targetBoardId")
  targetBoard: Board;

  @ForeignKey(() => PipelineStage)
  @Column
  targetStageId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Board)
  @Column
  boardId: number;

  // Chave explícita: há duas ligações com Board (esta e `targetBoardId`), e sem
  // dizer qual usar o Sequelize associa pela errada.
  @BelongsTo(() => Board, "boardId")
  board: Board;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @HasMany(() => Deal)
  deals: Deal[];
}

export default PipelineStage;
