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
  // ── CRM / Funil de vendas ─────────────────────────────────────────────────
  crm: {
    label: "CRM (Quadros)",
    permissions: {
      "crm:access":       "Acesso ao módulo",
      "crm:view":         "Visualizar quadros",
      "crm:create":       "Criar negócio",
      "crm:edit":         "Editar negócio",
      "crm:move":         "Mover negócio entre colunas",
      "crm:delete":       "Excluir negócio",
      "crm:manageStages": "Configurar colunas do quadro",
      "crm:manageBoards": "Criar e ordenar quadros",
      "crm:viewAll":      "Ver negócios de todos os responsáveis",
    },
  },
  // ── Etiquetas ─────────────────────────────────────────────────────────────
  tags: {
    label: "Etiquetas",
    permissions: {
      "tags:access": "Acesso ao módulo",
      "tags:view":   "Visualizar",
      "tags:create": "Criar",
      "tags:edit":   "Editar",
      "tags:delete": "Excluir",
      "tags:assign": "Aplicar etiqueta em conversas",
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
  // ── Produtos ──────────────────────────────────────────────────────────────
  products: {
    label: "Produtos",
    permissions: {
      "products:access": "Acesso ao módulo",
      // Ver o catálogo vai junto com ver o CRM: quem orça precisa escolher
      // produtos. Mexer no catálogo é à parte -- preço errado aqui contamina
      // todo orçamento feito daqui para a frente.
      "products:manage": "Cadastrar e editar produtos",
    },
  },
  // ── Figurinhas ────────────────────────────────────────────────────────────
  stickers: {
    label: "Figurinhas",
    permissions: {
      "stickers:access": "Acesso ao módulo",
      "stickers:view":   "Visualizar",
      "stickers:create": "Adicionar",
      "stickers:delete": "Excluir",
      // Separada das demais de propósito: todo atendente manda figurinha na
      // conversa, mas mexer no catálogo da empresa é de quem o organiza.
      "stickers:send":   "Enviar em conversas",
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

// Permissões de quem é atendente (profile "member") e ainda não foi colocado em
// nenhum grupo. Sem isto, a regra "negado por padrão" trancava todos os usuários
// comuns para fora do sistema até alguém criar grupos.
//
// Só entra o que o dia a dia do atendimento exige. De fora ficam, de propósito,
// tudo que apaga, exporta, importa ou configura: delete, export, import,
// viewAll, manage*, e os módulos de usuários (escrita), filas, conexões
// (escrita), configurações e grupos de permissão. Quem precisar de mais é
// colocado em um grupo, que substitui este conjunto.
export const DEFAULT_MEMBER_PERMISSIONS: readonly string[] = [
  "dashboard:access", "dashboard:view",
  "tickets:access", "tickets:view", "tickets:create", "tickets:edit", "tickets:transfer",
  "contacts:access", "contacts:view", "contacts:create", "contacts:edit",
  "clients:access", "clients:view", "clients:create", "clients:edit",
  "crm:access", "crm:view", "crm:create", "crm:edit", "crm:move",
  "products:access",
  "tags:access", "tags:view", "tags:assign",
  "quickAnswers:access", "quickAnswers:view", "quickAnswers:create", "quickAnswers:edit",
  "stickers:access", "stickers:view", "stickers:send",
  // Somente leitura: o front carrega o próprio usuário, a lista de conexões
  // e a lista de colegas (para transferir) ao abrir o atendimento.
  "connections:view",
  "users:view",
];