/**
 * Catálogo central de permissões do frontend.
 * Espelha o PERMISSION_MODULES do backend.
 * Adicionar novas permissões: inserir aqui — sem alterar arquitetura.
 */
export const PERMISSION_MODULES = {
  tickets: {
    label: "Conversas",
    icon: "Chat",
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
  contacts: {
    label: "Contatos",
    icon: "Contacts",
    permissions: {
      "contacts:access": "Acesso ao módulo",
      "contacts:view":   "Visualizar",
      "contacts:create": "Criar",
      "contacts:edit":   "Editar",
      "contacts:delete": "Excluir",
      "contacts:import": "Importar contatos",
    },
  },
  clients: {
    label: "Clientes",
    icon: "Business",
    permissions: {
      "clients:access": "Acesso ao módulo",
      "clients:view":   "Visualizar",
      "clients:create": "Criar",
      "clients:edit":   "Editar",
      "clients:delete": "Excluir",
    },
  },
  campaigns: {
    label: "Campanhas",
    icon: "Campaign",
    permissions: {
      "campaigns:access": "Acesso ao módulo",
      "campaigns:view":   "Visualizar",
      "campaigns:create": "Criar",
      "campaigns:edit":   "Editar",
      "campaigns:send":   "Enviar",
      "campaigns:cancel": "Cancelar",
    },
  },
  quickAnswers: {
    label: "Respostas Rápidas",
    icon: "QuickreplyOutlined",
    permissions: {
      "quickAnswers:access": "Acesso ao módulo",
      "quickAnswers:view":   "Visualizar",
      "quickAnswers:create": "Criar",
      "quickAnswers:edit":   "Editar",
      "quickAnswers:delete": "Excluir",
    },
  },
  queues: {
    label: "Filas",
    icon: "AccountTree",
    permissions: {
      "queues:access": "Acesso ao módulo",
      "queues:view":   "Visualizar",
      "queues:create": "Criar",
      "queues:edit":   "Editar",
      "queues:delete": "Excluir",
    },
  },
  users: {
    label: "Usuários",
    icon: "People",
    permissions: {
      "users:access": "Acesso ao módulo",
      "users:view":   "Visualizar",
      "users:create": "Criar",
      "users:edit":   "Editar",
      "users:delete": "Excluir",
    },
  },
  connections: {
    label: "Conexões",
    icon: "DevicesOther",
    permissions: {
      "connections:access": "Acesso ao módulo",
      "connections:view":   "Visualizar",
      "connections:create": "Criar",
      "connections:edit":   "Editar",
      "connections:delete": "Excluir",
    },
  },
  dashboard: {
    label: "Dashboard",
    icon: "Dashboard",
    permissions: {
      "dashboard:access": "Acesso ao módulo",
      "dashboard:view":   "Visualizar métricas",
    },
  },
  settings: {
    label: "Configurações",
    icon: "Settings",
    permissions: {
      "settings:access": "Acesso ao módulo",
      "settings:view":   "Visualizar",
      "settings:edit":   "Editar",
    },
  },
  permissionGroups: {
    label: "Grupos de Permissão",
    icon: "Security",
    permissions: {
      "permissionGroups:access": "Acesso ao módulo",
      "permissionGroups:view":   "Visualizar",
      "permissionGroups:create": "Criar",
      "permissionGroups:edit":   "Editar",
      "permissionGroups:delete": "Excluir",
    },
  },
};

// Flat list de todas as permissões
export const ALL_PERMISSIONS = Object.values(PERMISSION_MODULES).flatMap(
  (module) => Object.keys(module.permissions)
);

// Helper: dado um ID de permissão, retorna o label legível
export const getPermissionLabel = (permissionId) => {
  for (const module of Object.values(PERMISSION_MODULES)) {
    if (module.permissions[permissionId]) {
      return module.permissions[permissionId];
    }
  }
  return permissionId;
};

// Helper: dado um ID de permissão, retorna o label do módulo
export const getModuleLabel = (permissionId) => {
  const [moduleKey] = permissionId.split(":");
  return PERMISSION_MODULES[moduleKey]?.label ?? moduleKey;
};
