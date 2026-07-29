// Catálogo central de permissões do sistema.
// Organizado por módulo:ação para clareza e escalabilidade.
// Para adicionar novas permissões: basta inserir aqui — sem alterar arquitetura.

export const PERMISSION_MODULES = {
  // ── Conversas ─────────────────────────────────────────────────────────────
  tickets: {
    label: "Conversas",
    permissions: {
      "tickets:access":   "Acesso ao módulo",
      "tickets:view":     "Visualizar",
      "tickets:create":   "Criar",
      "tickets:edit":     "Editar",
      "tickets:delete":   "Excluir",
      "tickets:transfer": "Transferir",
      "tickets:export":   "Exportar",
      "tickets:viewAll":  "Ver todas as conversas",
    },
  },
  // ── Contatos ──────────────────────────────────────────────────────────────
  contacts: {
    label: "Contatos",
    permissions: {
      "contacts:access": "Acesso ao módulo",
      "contacts:view":   "Visualizar",
      "contacts:create": "Criar",
      "contacts:edit":   "Editar",
      "contacts:delete": "Excluir",
      "contacts:import": "Importar contatos",
    },
  },
  // ── Clientes (CRM) ───────────────────────────────────────────────────────
  clients: {
    label: "Clientes",
    permissions: {
      "clients:access": "Acesso ao módulo",
      "clients:view":   "Visualizar",
      "clients:create": "Criar",
      "clients:edit":   "Editar",
      "clients:delete": "Excluir",
    },
  },
  // ── Campanhas ─────────────────────────────────────────────────────────────
  campaigns: {
    label: "Campanhas",
    permissions: {
      "campaigns:access": "Acesso ao módulo",
      "campaigns:view":   "Visualizar",
      "campaigns:create": "Criar",
      "campaigns:edit":   "Editar",
      "campaigns:send":   "Enviar",
      "campaigns:cancel": "Cancelar",
    },
  },
  // ── Respostas Rápidas ─────────────────────────────────────────────────────
  quickAnswers: {
    label: "Respostas Rápidas",
    permissions: {
      "quickAnswers:access": "Acesso ao módulo",
      "quickAnswers:view":   "Visualizar",
      "quickAnswers:create": "Criar",
      "quickAnswers:edit":   "Editar",
      "quickAnswers:delete": "Excluir",
    },
  },
  // ── Filas ─────────────────────────────────────────────────────────────────
  queues: {
    label: "Filas",
    permissions: {
      "queues:access": "Acesso ao módulo",
      "queues:view":   "Visualizar",
      "queues:create": "Criar",
      "queues:edit":   "Editar",
      "queues:delete": "Excluir",
    },
  },
  // ── Usuários ──────────────────────────────────────────────────────────────
  users: {
    label: "Usuários",
    permissions: {
      "users:access": "Acesso ao módulo",
      "users:view":   "Visualizar",
      "users:create": "Criar",
      "users:edit":   "Editar",
      "users:delete": "Excluir",
    },
  },
  // ── Conexões (WhatsApp) ───────────────────────────────────────────────────
  connections: {
    label: "Conexões",
    permissions: {
      "connections:access": "Acesso ao módulo",
      "connections:view":   "Visualizar",
      "connections:create": "Criar",
      "connections:edit":   "Editar",
      "connections:delete": "Excluir",
    },
  },
  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: {
    label: "Dashboard",
    permissions: {
      "dashboard:access": "Acesso ao módulo",
      "dashboard:view":   "Visualizar métricas",
    },
  },
  // ── Configurações ─────────────────────────────────────────────────────────
  settings: {
    label: "Configurações",
    permissions: {
      "settings:access": "Acesso ao módulo",
      "settings:view":   "Visualizar",
      "settings:edit":   "Editar",
    },
  },
  // ── Grupos de Permissão ───────────────────────────────────────────────────
  permissionGroups: {
    label: "Grupos de Permissão",
    permissions: {
      "permissionGroups:access": "Acesso ao módulo",
      "permissionGroups:view":   "Visualizar",
      "permissionGroups:create": "Criar",
      "permissionGroups:edit":   "Editar",
      "permissionGroups:delete": "Excluir",
    },
  },
} as const;

// Flat list de todas as permissões disponíveis (derivado dos módulos acima)
// Usa reduce em vez de flatMap para compatibilidade com target ES6
export const AVAILABLE_PERMISSIONS: readonly string[] = Object.values(PERMISSION_MODULES).reduce(
  (acc: string[], mod: { label: string; permissions: Record<string, string> }) =>
    acc.concat(Object.keys(mod.permissions)),
  []
);

export type Permission = string;