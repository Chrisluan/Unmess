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
  BelongsToMany,
  HasMany
} from "sequelize-typescript";
import Company from "./Company";
import Customer from "./Customer";
import Contact from "./Contact";
import User from "./User";
import Board from "./Board";
import PipelineStage from "./PipelineStage";
import DealActivity from "./DealActivity";
import Ticket from "./Ticket";
import DealTicket from "./DealTicket";
import DealItem from "./DealItem";

/**
 * Negócio — o card do Kanban.
 *
 * Um cliente pode ter vários negócios ao mesmo tempo (orçamento de camisetas
 * e de banners, por exemplo), por isso o funil vive aqui e não no Customer.
 *
 * Cada card vale para um quadro só. Ao concluir um quadro, este card é
 * arquivado (status "moved") e um novo nasce no quadro seguinte com id
 * próprio. Os cards da mesma jornada compartilham o `rootDealId`, que é o que
 * impede o relatório de contar a mesma venda uma vez por quadro.
 */
@Table
class Deal extends Model<Deal> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  title: string;

  /**
   * MySQL devolve DECIMAL como string; o getter normaliza para número para o
   * frontend não precisar converter antes de somar os totais da coluna.
   */
  @Default(0)
  @Column(DataType.DECIMAL(15, 2))
  get value(): number {
    const bruto = this.getDataValue("value");
    return bruto === null || bruto === undefined ? 0 : Number(bruto);
  }

  @Column
  expectedCloseAt: Date;

  /**
   * open   — ativo no quadro atual
   * moved  — concluiu o quadro e continuou em outro card (fica só no histórico)
   * won    — chegou ao fim do último quadro: venda faturada
   * lost   — perdido em qualquer quadro
   */
  @Default("open")
  @Column
  status: string;

  @Column
  lostReason: string;

  @Column
  closedAt: Date;

  // Momento em que o card saiu do board por ter avançado de quadro.
  @Column
  archivedAt: Date;

  // Posição do card dentro da coluna (menor primeiro).
  @Default(0)
  @Column
  order: number;

  @Column(DataType.TEXT)
  notes: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => PipelineStage)
  @Column
  stageId: number;

  @BelongsTo(() => PipelineStage)
  stage: PipelineStage;

  // Redundante com stage.boardId, mas evita join em toda carga do board.
  @ForeignKey(() => Board)
  @Column
  boardId: number;

  @BelongsTo(() => Board)
  board: Board;

  /**
   * Primeiro card da jornada. Nulo neste próprio card significa que ele é a
   * raiz — a chave da cadeia é sempre `rootDealId || id`.
   */
  @ForeignKey(() => Deal)
  @Column
  rootDealId: number;

  // Card imediatamente anterior, para reconstruir o caminho quadro a quadro.
  @ForeignKey(() => Deal)
  @Column
  previousDealId: number;

  @ForeignKey(() => Customer)
  @Column
  customerId: number;

  @BelongsTo(() => Customer)
  customer: Customer;

  /**
   * Contato do WhatsApp. Redundante com customer.contactId na maioria dos
   * casos, mas permite abrir negócio para quem ainda não virou cliente.
   */
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

  @HasMany(() => DealActivity)
  activities: DealActivity[];

  /**
   * As linhas do orçamento. O valor do negócio passa a ser a soma delas assim
   * que ele ganha itens -- ver SyncDealItemsService.
   */
  @HasMany(() => DealItem)
  items: DealItem[];

  @BelongsToMany(() => Ticket, () => DealTicket)
  tickets: Ticket[];
}

export default Deal;
