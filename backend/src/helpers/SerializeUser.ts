import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";

export interface SerializedUser {
  id: number;
  name: string;
  email: string;
  /** "super" (dono da plataforma) ou "member". Não decide permissão. */
  profile: string;
  companyId: number;
  roleId: number | null;
  roleName: string | null;
  maxSimultaneousTickets: number;
  online: boolean;
  lastSeenAt: Date | null;
  whatsappId: number | null;
  queues: Queue[];
  whatsapp: Whatsapp;
}

/**
 * O usuário como ele sai da API.
 *
 * As permissões não vêm aqui de propósito: o frontend as busca em
 * `GET /access/me`, que é a mesma conta que as rotas fazem. Antes, o objeto
 * carregava `customPermissions` cru — o JSON dos overrides individuais — para
 * qualquer tela que listasse usuários, e a resolução ficava por conta de quem
 * consumisse. Duas fontes para o mesmo fato divergem; esta ficou sendo uma só.
 */
export const SerializeUser = (user: User): SerializedUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    roleId: user.roleId ?? null,
    roleName: user.role?.name ?? null,
    maxSimultaneousTickets: user.maxSimultaneousTickets,
    online: user.online,
    lastSeenAt: user.lastSeenAt,
    whatsappId: user.whatsappId,
    queues: user.queues,
    whatsapp: user.whatsapp,
  };
};
