import {
  Table,
  Column,
  Model,
  ForeignKey,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";
import Deal from "./Deal";
import Ticket from "./Ticket";

/**
 * Liga um negócio às conversas de WhatsApp que o originaram ou trataram.
 * Segue o mesmo formato de TicketTag.
 */
@Table
class DealTicket extends Model<DealTicket> {
  @ForeignKey(() => Deal)
  @Column
  dealId: number;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default DealTicket;
