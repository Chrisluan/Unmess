import User from "../../models/User";
import Role from "../../models/Role";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import UpdateDeletedUserOpenTicketsStatus from "../../helpers/UpdateDeletedUserOpenTicketsStatus";
import { SLUG_ADMINISTRADOR } from "../../helpers/permissions/roleTemplates";
import { garantirQueSobraAdministrador } from "../../helpers/permissions/guards";

const DeleteUserService = async (
  id: string | number,
  companyId: number,
  atorId?: number
): Promise<void> => {
  const user = await User.findOne({
    where: { id, companyId },
    include: [{ model: Role, as: "role" }]
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  /**
   * Ninguém apaga a si mesmo, e a empresa não fica sem administrador.
   *
   * Excluir o último Administrador deixaria a empresa sem ninguém capaz de
   * conceder acesso a ninguém — inclusive sem ninguém capaz de criar outro
   * administrador. O conserto seria à mão no banco.
   */
  if (atorId !== undefined && Number(atorId) === user.id) {
    throw new AppError(
      "Você não pode remover o próprio acesso. Peça a outro administrador.",
      403
    );
  }

  if (user.role?.slug === SLUG_ADMINISTRADOR) {
    const administradores = await User.count({
      where: { companyId, roleId: user.roleId }
    });
    garantirQueSobraAdministrador(administradores - 1);
  }

  const userOpenTickets: Ticket[] = await user.$get("tickets", {
    where: { status: "open" }
  });

  if (userOpenTickets.length > 0) {
    UpdateDeletedUserOpenTicketsStatus(userOpenTickets);
  }

  await user.destroy();
};

export default DeleteUserService;
