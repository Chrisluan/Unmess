// Catálogo central de permissões do sistema. Toda checagem de permissão
// granular (grupos e overrides individuais) deve usar chaves daqui, para
// manter consistência entre backend, frontend e telas de configuração.
export const AVAILABLE_PERMISSIONS = [
  "chats:viewAll",
  "chats:delete",
  "chats:transfer",
  "customers:manage",
  "users:manage",
  "queues:manage",
  "settings:manage",
  "reports:view",
  "financial:manage"
] as const;

export type Permission = (typeof AVAILABLE_PERMISSIONS)[number];
