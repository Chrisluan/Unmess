import { Request, Response } from "express";

import { getIO } from "../libs/socket";
import { companyRoom, userRoom } from "../libs/socketRooms";
import getCompanyId from "../helpers/GetCompanyId";
import { usuarioPode } from "../helpers/permissions/resolve";
import TeamChannel from "../models/TeamChannel";
import * as Chat from "../services/TeamChatServices/TeamChatService";

/**
 * Para onde vai o aviso de algo que aconteceu num canal: a empresa inteira,
 * se o canal é aberto; só as duas pessoas, se é conversa a dois. Emitir uma
 * conversa a dois para a sala da empresa entregaria o texto a todo mundo.
 */
const emitirNoCanal = (
  canal: TeamChannel,
  evento: string,
  dados: Record<string, unknown>
): void => {
  const io = getIO();
  if (canal.kind === "direct") {
    Chat.participantesDaConversa(canal).forEach(id =>
      io.to(userRoom(canal.companyId, id)).emit(evento, dados)
    );
    return;
  }
  io.to(companyRoom(canal.companyId)).emit(evento, dados);
};

const eu = (req: Request): number => Number(req.user.id);

export const listChannels = async (req: Request, res: Response): Promise<Response> => {
  const canais = await Chat.listarCanais(getCompanyId(req), eu(req));
  return res.json(canais);
};

export const listPeople = async (req: Request, res: Response): Promise<Response> => {
  const pessoas = await Chat.listarPessoas(getCompanyId(req));
  return res.json(pessoas);
};

export const storeChannel = async (req: Request, res: Response): Promise<Response> => {
  const canal = await Chat.criarCanal(getCompanyId(req), eu(req), req.body || {});
  emitirNoCanal(canal, "teamChat:channel", { action: "create", channelId: canal.id });
  return res.status(201).json(canal);
};

export const updateChannel = async (req: Request, res: Response): Promise<Response> => {
  const canal = await Chat.editarCanal(
    getCompanyId(req),
    req.params.channelId,
    req.body || {}
  );
  emitirNoCanal(canal, "teamChat:channel", { action: "update", channelId: canal.id });
  return res.json(canal);
};

export const archiveChannel = async (req: Request, res: Response): Promise<Response> => {
  const canal = await Chat.arquivarCanal(getCompanyId(req), req.params.channelId);
  emitirNoCanal(canal, "teamChat:channel", { action: "delete", channelId: canal.id });
  return res.status(204).send();
};

export const openDirect = async (req: Request, res: Response): Promise<Response> => {
  const canal = await Chat.abrirConversa(
    getCompanyId(req),
    eu(req),
    Number(req.params.userId)
  );
  emitirNoCanal(canal, "teamChat:channel", { action: "create", channelId: canal.id });
  return res.json({ id: canal.id });
};

export const listMessages = async (req: Request, res: Response): Promise<Response> => {
  const canal = await Chat.canalAcessivel(
    req.params.channelId,
    getCompanyId(req),
    eu(req)
  );
  const antesDe = Number(req.query.before) || undefined;
  const mensagens = await Chat.listarMensagens(canal, antesDe);
  return res.json(mensagens);
};

export const storeMessage = async (req: Request, res: Response): Promise<Response> => {
  const canal = await Chat.canalAcessivel(
    req.params.channelId,
    getCompanyId(req),
    eu(req)
  );
  const mensagem = await Chat.enviarMensagem(canal, eu(req), req.body?.body);
  emitirNoCanal(canal, "teamChat:message", { action: "create", message: mensagem });
  return res.status(201).json(mensagem);
};

export const updateMessage = async (req: Request, res: Response): Promise<Response> => {
  const { mensagem, canal } = await Chat.editarMensagem(
    getCompanyId(req),
    eu(req),
    req.params.messageId,
    req.body?.body
  );
  emitirNoCanal(canal, "teamChat:message", { action: "update", message: mensagem });
  return res.json(mensagem);
};

export const removeMessage = async (req: Request, res: Response): Promise<Response> => {
  const podeModerar = await usuarioPode(eu(req), "teamChat:manage");
  const { mensagem, canal } = await Chat.apagarMensagem(
    getCompanyId(req),
    eu(req),
    req.params.messageId,
    podeModerar
  );
  emitirNoCanal(canal, "teamChat:message", { action: "update", message: mensagem });
  return res.status(204).send();
};

export const markRead = async (req: Request, res: Response): Promise<Response> => {
  const canal = await Chat.canalAcessivel(
    req.params.channelId,
    getCompanyId(req),
    eu(req)
  );
  const ate = await Chat.marcarComoLido(canal.id, eu(req));
  // As outras abas da mesma pessoa zeram o contador junto.
  getIO()
    .to(userRoom(canal.companyId, eu(req)))
    .emit("teamChat:read", { channelId: canal.id, lastReadMessageId: ate });
  return res.json({ lastReadMessageId: ate });
};
