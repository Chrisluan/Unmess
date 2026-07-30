import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  companyId: number;
  permissionGroupId: number | null;
  customPermissions: string | null;
  maxSimultaneousTickets: number;
  online: boolean;
  lastSeenAt: Date | null;
  whatsappId: number | null;
  queues: Queue[];
  whatsapp: Whatsapp;
}

export const SerializeUser = (user: User): SerializedUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    permissionGroupId: user.permissionGroupId,
    customPermissions: user.customPermissions,
    maxSimultaneousTickets: user.maxSimultaneousTickets,
    online: user.online,
    lastSeenAt: user.lastSeenAt,
    whatsappId: user.whatsappId,
    queues: user.queues,
    whatsapp: user.whatsapp,
  };
};
