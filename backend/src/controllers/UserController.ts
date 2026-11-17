import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";
import { resolverAcessoDoUsuario } from "../helpers/permissions/resolve";

import CreateUserService from "../services/UserServices/CreateUserService";
import ListUsersService from "../services/UserServices/ListUsersService";
import UpdateUserService from "../services/UserServices/UpdateUserService";
import ShowUserService from "../services/UserServices/ShowUserService";
import DeleteUserService from "../services/UserServices/DeleteUserService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const companyId = getCompanyId(req);

  const { users, count, hasMore } = await ListUsersService({
    searchParam,
    pageNumber,
    companyId
  });

  return res.json({ users, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    email,
    password,
    name,
    queueIds,
    whatsappId,
    roleId,
    maxSimultaneousTickets
  } = req.body;

  // `profile` não é mais lido do corpo. Ele separa o super-admin da
  // plataforma de quem é membro de uma empresa, e não é a API de usuários
  // que decide isso — antes, mandar profile: "admin" no cadastro bastava
  // para criar alguém com acesso total.
  const ator = await resolverAcessoDoUsuario(Number(req.user.id));

  const user = await CreateUserService({
    email,
    password,
    name,
    queueIds,
    whatsappId,
    roleId,
    maxSimultaneousTickets,
    companyId: getCompanyId(req),
    ator,
    atorPodeAtribuirCargo:
      ator.isSuper || ator.permissions.includes("roles:assign")
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("user", {
    action: "create",
    user
  });

  return res.status(200).json(user);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;

  const user = await ShowUserService(userId);

  if (
    req.user.profile !== "super" &&
    user.companyId !== req.user.companyId
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return res.status(200).json(user);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const userData = req.body;

  const user = await UpdateUserService({
    userData,
    userId,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("user", {
    action: "update",
    user
  });

  return res.status(200).json(user);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;

  await DeleteUserService(userId, getCompanyId(req), Number(req.user.id));

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("user", {
    action: "delete",
    userId
  });

  return res.status(200).json({ message: "User deleted" });
};
