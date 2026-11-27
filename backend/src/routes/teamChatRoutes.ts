import { Router } from "express";

import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import { semPermissao } from "../helpers/permissions/routeGuard";
import * as TeamChatController from "../controllers/TeamChatController";

/**
 * Chat de equipe.
 *
 * Conversar é de toda pessoa da empresa — por isso a maioria das rotas
 * dispensa permissão. O que separa um canal do outro é a regra de acesso do
 * serviço (aberto para a empresa, ou só para os dois da conversa), conferida
 * em cada chamada. Gerenciar a lista de canais é o que tem dono.
 */
const teamChatRoutes = Router();

const LIVRE = "conversar com a equipe é de toda pessoa da empresa; o serviço confere o acesso ao canal";

teamChatRoutes.get(
  "/team-chat/channels",
  isAuth, requiresCompany, semPermissao(LIVRE),
  TeamChatController.listChannels
);

teamChatRoutes.get(
  "/team-chat/people",
  isAuth, requiresCompany,
  semPermissao("nome e presença dos colegas, para chamar alguém para conversar"),
  TeamChatController.listPeople
);

teamChatRoutes.post(
  "/team-chat/channels",
  isAuth, requiresCompany, hasPermission("teamChat:manage"),
  TeamChatController.storeChannel
);

teamChatRoutes.put(
  "/team-chat/channels/:channelId",
  isAuth, requiresCompany, hasPermission("teamChat:manage"),
  TeamChatController.updateChannel
);

teamChatRoutes.delete(
  "/team-chat/channels/:channelId",
  isAuth, requiresCompany, hasPermission("teamChat:manage"),
  TeamChatController.archiveChannel
);

teamChatRoutes.post(
  "/team-chat/direct/:userId",
  isAuth, requiresCompany, semPermissao(LIVRE),
  TeamChatController.openDirect
);

teamChatRoutes.get(
  "/team-chat/channels/:channelId/messages",
  isAuth, requiresCompany, semPermissao(LIVRE),
  TeamChatController.listMessages
);

teamChatRoutes.post(
  "/team-chat/channels/:channelId/messages",
  isAuth, requiresCompany, semPermissao(LIVRE),
  TeamChatController.storeMessage
);

teamChatRoutes.post(
  "/team-chat/channels/:channelId/read",
  isAuth, requiresCompany, semPermissao(LIVRE),
  TeamChatController.markRead
);

teamChatRoutes.put(
  "/team-chat/messages/:messageId",
  isAuth, requiresCompany,
  semPermissao("editar a própria mensagem; o serviço recusa a de outra pessoa"),
  TeamChatController.updateMessage
);

teamChatRoutes.delete(
  "/team-chat/messages/:messageId",
  isAuth, requiresCompany,
  semPermissao("apagar a própria mensagem; apagar a de outra pessoa exige teamChat:manage, conferida no controller"),
  TeamChatController.removeMessage
);

export default teamChatRoutes;
