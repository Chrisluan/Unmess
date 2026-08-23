/**
 * Catálogo de permissões — a única fonte de verdade do sistema.
 *
 * Tudo que fala sobre permissão nasce aqui: o backend valida contra este
 * arquivo, e o frontend o recebe pela API (GET /access/catalog). Não existe
 * segunda cópia em lugar nenhum. A cópia anterior no frontend divergiu em
 * silêncio e deixou quatro módulos inteiros — CRM, Financeiro, Produtos e
 * Figurinhas — sem como serem concedidos pela tela; era por isso que a saída
 * acabava sendo marcar todo mundo como administrador.
 *
 * Para criar uma permissão nova: acrescente a ação no módulo certo e use
 * hasPermission("modulo:acao") na rota. A auditoria de rotas derruba o boot
 * se a permissão citada na rota não existir aqui.
 */

/**
 * Três níveis, na ordem em que a confiança cresce. O editor de cargos usa
 * isso para oferecer "Somente ver / Ver e operar / Controle total" antes de
 * abrir as caixinhas uma a uma: quase todo cargo real é um desses três, e
 * escolher entre três opções é mais honesto do que marcar oito caixas e
 * torcer para o conjunto fazer sentido.
 */
export type Nivel = "ver" | "operar" | "gerenciar";

export const NIVEIS: Nivel[] = ["ver", "operar", "gerenciar"];

export interface AcaoDePermissao {
  /** Frase curta, no infinitivo, do ponto de vista de quem administra. */
  label: string;
  /** O que muda na prática para quem recebe — e o risco de conceder. */
  descricao: string;
  nivel: Nivel;
  /**
   * Permissões sem as quais esta não funciona. Conceder uma ação concede
   * automaticamente suas dependências: não existe "pode excluir conversa mas
   * não pode ver conversa" — isso só produz uma tela que abre vazia.
   */
  requer?: string[];
}

export interface ModuloDePermissao {
  label: string;
  descricao: string;
  /** Nome do ícone no @mui/icons-material, resolvido pelo frontend. */
  icone: string;
  ordem: number;
  acoes: Record<string, AcaoDePermissao>;
}

export const MODULES: Record<string, ModuloDePermissao> = {
  // ── Conversas ─────────────────────────────────────────────────────────────
  tickets: {
    label: "Conversas",
    descricao: "Atendimento no WhatsApp: abrir, responder e encerrar conversas.",
    icone: "ChatOutlined",
    ordem: 1,
    acoes: {
      view: {
        label: "Abrir o módulo e ver as conversas",
        descricao: "Vê apenas as conversas das próprias filas e as atribuídas a si.",
        nivel: "ver"
      },
      create: {
        label: "Iniciar conversa",
        descricao: "Pode puxar um contato e começar um atendimento novo.",
        nivel: "operar",
        requer: ["tickets:view"]
      },
      edit: {
        label: "Responder e encerrar",
        descricao: "Enviar mensagens, anotar notas internas e mudar o status da conversa.",
        nivel: "operar",
        requer: ["tickets:view"]
      },
      transfer: {
        label: "Transferir para outra fila ou pessoa",
        descricao: "Tira a conversa de quem está atendendo e passa adiante.",
        nivel: "operar",
        requer: ["tickets:view"]
      },
      viewAll: {
        label: "Ver as conversas de todo mundo",
        descricao:
          "Ignora o limite de filas e enxerga o atendimento de toda a empresa. É a diferença entre atender e supervisionar.",
        nivel: "gerenciar",
        requer: ["tickets:view"]
      },
      delete: {
        label: "Excluir conversa",
        descricao: "Apaga a conversa e o histórico junto. Não tem desfazer.",
        nivel: "gerenciar",
        requer: ["tickets:view"]
      }
    }
  },

  // ── Contatos ──────────────────────────────────────────────────────────────
  contacts: {
    label: "Contatos",
    descricao: "A agenda de números de WhatsApp da empresa.",
    icone: "ContactsOutlined",
    ordem: 2,
    acoes: {
      view: {
        label: "Abrir o módulo e ver a agenda",
        descricao: "Consulta nomes, números e campos personalizados.",
        nivel: "ver"
      },
      create: {
        label: "Cadastrar contato",
        descricao: "Adiciona um número novo à agenda.",
        nivel: "operar",
        requer: ["contacts:view"]
      },
      edit: {
        label: "Editar contato",
        descricao: "Muda nome, número e campos personalizados de quem já está cadastrado.",
        nivel: "operar",
        requer: ["contacts:view"]
      },
      import: {
        label: "Importar contatos do aparelho",
        descricao: "Traz a agenda inteira do celular conectado de uma vez.",
        nivel: "gerenciar",
        requer: ["contacts:view"]
      },
      delete: {
        label: "Excluir contato",
        descricao: "Remove o contato da agenda.",
        nivel: "gerenciar",
        requer: ["contacts:view"]
      }
    }
  },

  // ── Clientes ──────────────────────────────────────────────────────────────
  clients: {
    label: "Clientes",
    descricao: "Ficha cadastral: razão social, documento, endereço e histórico.",
    icone: "BusinessOutlined",
    ordem: 3,
    acoes: {
      view: {
        label: "Abrir o módulo e ver as fichas",
        descricao: "Consulta dados cadastrais e o histórico de cada cliente.",
        nivel: "ver"
      },
      create: {
        label: "Cadastrar cliente",
        descricao: "Abre ficha nova.",
        nivel: "operar",
        requer: ["clients:view"]
      },
      edit: {
        label: "Editar ficha",
        descricao: "Altera dados cadastrais, inclusive documento e endereço de cobrança.",
        nivel: "operar",
        requer: ["clients:view"]
      },
      delete: {
        label: "Excluir cliente",
        descricao: "Remove a ficha do cadastro.",
        nivel: "gerenciar",
        requer: ["clients:view"]
      }
    }
  },

  // ── Funil de vendas ───────────────────────────────────────────────────────
  crm: {
    label: "Funil de vendas",
    descricao: "Quadros, oportunidades, orçamentos e propostas.",
    icone: "ViewKanbanOutlined",
    ordem: 4,
    acoes: {
      view: {
        label: "Abrir o módulo e ver o funil",
        descricao: "Vê os quadros e as oportunidades sob sua responsabilidade.",
        nivel: "ver"
      },
      create: {
        label: "Criar oportunidade",
        descricao: "Abre negócio novo no funil.",
        nivel: "operar",
        requer: ["crm:view"]
      },
      edit: {
        label: "Editar oportunidade e orçamento",
        descricao: "Mexe em itens, valores, prazos e na proposta enviada ao cliente.",
        nivel: "operar",
        requer: ["crm:view"]
      },
      move: {
        label: "Mover entre colunas",
        descricao: "Avança e recua a oportunidade no funil, inclusive marcar como ganha ou perdida.",
        nivel: "operar",
        requer: ["crm:view"]
      },
      viewAll: {
        label: "Ver as oportunidades de todo mundo",
        descricao:
          "Enxerga o funil inteiro da empresa, não só o que é seu. Inclui os valores negociados por outras pessoas.",
        nivel: "gerenciar",
        requer: ["crm:view"]
      },
      manageStages: {
        label: "Configurar as colunas do quadro",
        descricao: "Renomeia, cria e reordena etapas. Muda o funil para todo mundo ao mesmo tempo.",
        nivel: "gerenciar",
        requer: ["crm:view"]
      },
      manageBoards: {
        label: "Criar e ordenar quadros",
        descricao: "Cria funis novos e define a ordem em que aparecem.",
        nivel: "gerenciar",
        requer: ["crm:view"]
      },
      delete: {
        label: "Excluir oportunidade",
        descricao: "Apaga o negócio e o histórico de atividades junto.",
        nivel: "gerenciar",
        requer: ["crm:view"]
      }
    }
  },

  // ── Produtos ──────────────────────────────────────────────────────────────
  products: {
    label: "Produtos",
    descricao: "Catálogo usado para montar orçamentos.",
    icone: "Inventory2Outlined",
    ordem: 5,
    acoes: {
      view: {
        label: "Consultar o catálogo",
        descricao:
          "Necessário para escolher produtos ao montar um orçamento. Quem vende precisa disto.",
        nivel: "ver"
      },
      manage: {
        label: "Cadastrar e editar produtos",
        descricao:
          "Mexe em preço, medida e custo. Um preço errado aqui contamina todo orçamento feito daqui para a frente.",
        nivel: "gerenciar",
        requer: ["products:view"]
      }
    }
  },

  // ── Financeiro ────────────────────────────────────────────────────────────
  // As ações são separadas por risco: consultar o que a empresa tem a receber
  // é uma coisa, dar baixa em dinheiro é outra, e configurar as contas da
  // empresa é uma terceira.
  finance: {
    label: "Financeiro",
    descricao: "Contas a receber, contas a pagar e fluxo de caixa.",
    icone: "PaymentsOutlined",
    ordem: 6,
    acoes: {
      view: {
        label: "Abrir o módulo e consultar lançamentos",
        descricao: "Vê o que a empresa tem a receber e a pagar, com valores e vencimentos.",
        nivel: "ver"
      },
      bill: {
        label: "Gerar e cancelar cobrança",
        descricao: "Emite a cobrança de um negócio ganho e pode cancelá-la.",
        nivel: "operar",
        requer: ["finance:view"]
      },
      settle: {
        label: "Dar baixa e estornar",
        descricao:
          "Declara que o dinheiro entrou ou saiu. É a ação que mexe no saldo — conceda a poucas pessoas.",
        nivel: "operar",
        requer: ["finance:view"]
      },
      cashflow: {
        label: "Ver o fluxo de caixa",
        descricao:
          "Saldo consolidado e projeção da empresa. É o retrato financeiro do negócio inteiro.",
        nivel: "gerenciar",
        requer: ["finance:view"]
      },
      manage: {
        label: "Configurar contas, categorias e condições",
        descricao:
          "Define para onde o dinheiro é lançado. Mudar isso reescreve como todo lançamento futuro é classificado.",
        nivel: "gerenciar",
        requer: ["finance:view"]
      }
    }
  },

  // ── Etiquetas ─────────────────────────────────────────────────────────────
  tags: {
    label: "Etiquetas",
    descricao: "Marcadores coloridos aplicados às conversas.",
    icone: "LocalOfferOutlined",
    ordem: 7,
    acoes: {
      view: {
        label: "Ver as etiquetas",
        descricao: "Consulta a lista de etiquetas da empresa.",
        nivel: "ver"
      },
      assign: {
        label: "Aplicar etiqueta em conversas",
        descricao: "Marca e desmarca conversas. É ação de atendimento, não de administração.",
        nivel: "operar",
        requer: ["tags:view", "tickets:view"]
      },
      create: {
        label: "Criar etiqueta",
        descricao: "Acrescenta uma etiqueta nova ao vocabulário da empresa.",
        nivel: "gerenciar",
        requer: ["tags:view"]
      },
      edit: {
        label: "Editar etiqueta",
        descricao: "Renomeia e troca a cor. Vale para todas as conversas já marcadas.",
        nivel: "gerenciar",
        requer: ["tags:view"]
      },
      delete: {
        label: "Excluir etiqueta",
        descricao: "Some de todas as conversas onde estava aplicada.",
        nivel: "gerenciar",
        requer: ["tags:view"]
      }
    }
  },

  // ── Respostas rápidas ─────────────────────────────────────────────────────
  quickAnswers: {
    label: "Respostas rápidas",
    descricao: "Mensagens prontas usadas durante o atendimento.",
    icone: "QuickreplyOutlined",
    ordem: 8,
    acoes: {
      view: {
        label: "Usar as respostas rápidas",
        descricao: "Consulta e insere as mensagens prontas na conversa.",
        nivel: "ver"
      },
      create: {
        label: "Criar resposta rápida",
        descricao: "Acrescenta uma mensagem pronta para a empresa inteira.",
        nivel: "operar",
        requer: ["quickAnswers:view"]
      },
      edit: {
        label: "Editar resposta rápida",
        descricao: "Reescreve uma mensagem pronta já em uso.",
        nivel: "operar",
        requer: ["quickAnswers:view"]
      },
      delete: {
        label: "Excluir resposta rápida",
        descricao: "Remove a mensagem pronta do catálogo.",
        nivel: "gerenciar",
        requer: ["quickAnswers:view"]
      }
    }
  },

  // ── Figurinhas ────────────────────────────────────────────────────────────
  stickers: {
    label: "Figurinhas",
    descricao: "Biblioteca de figurinhas da empresa.",
    icone: "EmojiEmotionsOutlined",
    ordem: 9,
    acoes: {
      view: {
        label: "Ver a biblioteca",
        descricao: "Consulta as figurinhas disponíveis.",
        nivel: "ver"
      },
      send: {
        label: "Enviar em conversas",
        descricao:
          "Separada de administrar a biblioteca de propósito: todo atendente manda figurinha, mas organizar o catálogo é de quem cuida dele.",
        nivel: "operar",
        requer: ["stickers:view", "tickets:view"]
      },
      create: {
        label: "Adicionar figurinha",
        descricao: "Sobe arquivo novo ou salva uma figurinha recebida do cliente.",
        nivel: "gerenciar",
        requer: ["stickers:view"]
      },
      delete: {
        label: "Excluir figurinha",
        descricao: "Remove do catálogo da empresa.",
        nivel: "gerenciar",
        requer: ["stickers:view"]
      }
    }
  },

  // ── Filas ─────────────────────────────────────────────────────────────────
  queues: {
    label: "Filas",
    descricao: "Setores para os quais o atendimento é distribuído.",
    icone: "AccountTreeOutlined",
    ordem: 10,
    acoes: {
      view: {
        label: "Ver as filas",
        descricao: "Consulta os setores existentes e suas mensagens automáticas.",
        nivel: "ver"
      },
      create: {
        label: "Criar fila",
        descricao: "Abre um setor novo de atendimento.",
        nivel: "gerenciar",
        requer: ["queues:view"]
      },
      edit: {
        label: "Editar fila",
        descricao: "Muda nome, cor e a saudação automática enviada ao cliente.",
        nivel: "gerenciar",
        requer: ["queues:view"]
      },
      delete: {
        label: "Excluir fila",
        descricao: "Remove o setor. As conversas dele ficam sem fila.",
        nivel: "gerenciar",
        requer: ["queues:view"]
      }
    }
  },

  // ── Conexões ──────────────────────────────────────────────────────────────
  connections: {
    label: "Conexões",
    descricao: "Os números de WhatsApp ligados ao sistema.",
    icone: "DevicesOtherOutlined",
    ordem: 11,
    acoes: {
      view: {
        label: "Ver as conexões",
        descricao: "Consulta quais números estão ligados e o status de cada um.",
        nivel: "ver"
      },
      session: {
        label: "Conectar, reconectar e desconectar",
        descricao:
          "Ler o QR Code e derrubar a sessão. Quem faz isso pode tirar a empresa inteira do ar até alguém reconectar.",
        nivel: "gerenciar",
        requer: ["connections:view"]
      },
      create: {
        label: "Adicionar número",
        descricao: "Cadastra uma conexão nova.",
        nivel: "gerenciar",
        requer: ["connections:view"]
      },
      edit: {
        label: "Editar conexão",
        descricao: "Muda nome, filas atendidas e mensagens automáticas do número.",
        nivel: "gerenciar",
        requer: ["connections:view"]
      },
      delete: {
        label: "Excluir conexão",
        descricao: "Remove o número do sistema junto com a sessão dele.",
        nivel: "gerenciar",
        requer: ["connections:view"]
      }
    }
  },

  // ── Painel ────────────────────────────────────────────────────────────────
  dashboard: {
    label: "Painel",
    descricao: "Indicadores de atendimento da empresa.",
    icone: "InsightsOutlined",
    ordem: 12,
    acoes: {
      view: {
        label: "Ver os indicadores",
        descricao: "Números de atendimento consolidados da empresa inteira.",
        nivel: "ver"
      }
    }
  },

  // ── Usuários ──────────────────────────────────────────────────────────────
  users: {
    label: "Usuários",
    descricao: "As pessoas que entram no sistema.",
    icone: "PeopleOutlined",
    ordem: 13,
    acoes: {
      view: {
        label: "Ver a equipe",
        descricao: "Lista quem tem acesso, com fila e cargo de cada pessoa.",
        nivel: "ver"
      },
      create: {
        label: "Cadastrar pessoa",
        descricao: "Cria um acesso novo. O cargo é atribuído à parte.",
        nivel: "gerenciar",
        requer: ["users:view"]
      },
      edit: {
        label: "Editar dados da pessoa",
        descricao:
          "Nome, e-mail, senha, filas e limite de atendimentos. Não inclui mexer em cargo nem em permissão.",
        nivel: "gerenciar",
        requer: ["users:view"]
      },
      delete: {
        label: "Remover acesso",
        descricao: "Tira a pessoa do sistema.",
        nivel: "gerenciar",
        requer: ["users:view"]
      }
    }
  },

  // ── Cargos e acessos ──────────────────────────────────────────────────────
  // O módulo que controla o próprio controle. Quem tem "manage" ou "assign"
  // aqui decide o que todo mundo pode fazer — é a permissão mais cara do
  // sistema, e por isso as três ações são separadas.
  roles: {
    label: "Cargos e acessos",
    descricao: "Quem pode o quê dentro do sistema.",
    icone: "AdminPanelSettingsOutlined",
    ordem: 14,
    acoes: {
      view: {
        label: "Ver os cargos",
        descricao: "Consulta os cargos existentes e o que cada um libera, sem poder alterar.",
        nivel: "ver"
      },
      assign: {
        label: "Definir o cargo de cada pessoa",
        descricao:
          "Escolhe qual cargo cada pessoa tem e cria exceções individuais. Não permite conceder nada além do que quem concede já tem.",
        nivel: "gerenciar",
        requer: ["roles:view", "users:view"]
      },
      manage: {
        label: "Criar e editar cargos",
        descricao:
          "Redefine o que um cargo libera para todas as pessoas que o têm. É a permissão mais poderosa da empresa depois de ser administrador.",
        nivel: "gerenciar",
        requer: ["roles:view"]
      }
    }
  },

  // ── Configurações ─────────────────────────────────────────────────────────
  settings: {
    label: "Configurações",
    descricao: "Ajustes gerais, horário de atendimento e status de conversa.",
    icone: "SettingsOutlined",
    ordem: 15,
    acoes: {
      view: {
        label: "Abrir as configurações",
        descricao: "Consulta os ajustes da empresa sem poder alterá-los.",
        nivel: "ver"
      },
      edit: {
        label: "Alterar as configurações",
        descricao:
          "Horário de atendimento, feriados, status de conversa e ajustes gerais. Vale para a empresa inteira.",
        nivel: "gerenciar",
        requer: ["settings:view"]
      }
    }
  }
};

export type Permission = string;

// ── Derivados ───────────────────────────────────────────────────────────────

const modulosOrdenados = Object.entries(MODULES).sort(
  ([, a], [, b]) => a.ordem - b.ordem
);

/** Todas as permissões existentes, na ordem em que a UI as apresenta. */
export const ALL_PERMISSIONS: readonly Permission[] = modulosOrdenados.reduce(
  (acc: string[], [moduloKey, modulo]) =>
    acc.concat(Object.keys(modulo.acoes).map(acao => `${moduloKey}:${acao}`)),
  []
);

const CONJUNTO_VALIDO = new Set<string>(ALL_PERMISSIONS);

/** Índice id → { moduloKey, acaoKey, acao } para consulta direta. */
const INDICE = new Map<
  string,
  { moduloKey: string; acaoKey: string; acao: AcaoDePermissao }
>();
modulosOrdenados.forEach(([moduloKey, modulo]) => {
  Object.entries(modulo.acoes).forEach(([acaoKey, acao]) => {
    INDICE.set(`${moduloKey}:${acaoKey}`, { moduloKey, acaoKey, acao });
  });
});

export const existePermissao = (id: string): boolean => CONJUNTO_VALIDO.has(id);

export const moduloDaPermissao = (id: string): string => id.split(":")[0];

/**
 * Nomes antigos que ficaram gravados no banco. O par "modulo:access" +
 * "modulo:view" nasceu como duas caixinhas para uma ideia só — a rota do
 * frontend exigia "access", a da API exigia "view", e marcar uma sem a outra
 * dava uma tela que abria vazia. Agora é uma só, e o que estava salvo é
 * traduzido tanto na migração quanto na leitura, para o caso de alguma linha
 * antiga escapar.
 */
export const PERMISSOES_RENOMEADAS: Record<string, string> = {
  "tickets:access": "tickets:view",
  "contacts:access": "contacts:view",
  "clients:access": "clients:view",
  "crm:access": "crm:view",
  "finance:access": "finance:view",
  "products:access": "products:view",
  "tags:access": "tags:view",
  "quickAnswers:access": "quickAnswers:view",
  "stickers:access": "stickers:view",
  "queues:access": "queues:view",
  "connections:access": "connections:view",
  "dashboard:access": "dashboard:view",
  "users:access": "users:view",
  "settings:access": "settings:view",
  // O módulo "Grupos de Permissão" virou "Cargos e acessos".
  "permissionGroups:access": "roles:view",
  "permissionGroups:view": "roles:view",
  "permissionGroups:create": "roles:manage",
  "permissionGroups:edit": "roles:manage",
  "permissionGroups:delete": "roles:manage"
};

/** Traduz um nome antigo, se for o caso, e devolve o id atual. */
export const normalizarPermissao = (id: string): string =>
  PERMISSOES_RENOMEADAS[id] ?? id;

/** Ordena pela ordem do catálogo, para o banco e a API ficarem estáveis. */
export const ordenar = (ids: string[]): Permission[] =>
  [...ids].sort(
    (a, b) => ALL_PERMISSIONS.indexOf(a) - ALL_PERMISSIONS.indexOf(b)
  );

/**
 * Limpa uma lista vinda de fora: traduz nomes antigos, joga fora o que não
 * existe mais no catálogo e remove repetições. Toda permissão que entra no
 * sistema passa por aqui — é o que impede uma permissão inventada de ser
 * gravada e o que faz uma permissão removida do catálogo parar de valer sem
 * precisar limpar o banco.
 */
export const sanitizar = (ids: unknown): Permission[] => {
  if (!Array.isArray(ids)) return [];
  const limpas = new Set<string>();
  ids.forEach(item => {
    if (typeof item !== "string") return;
    const id = normalizarPermissao(item.trim());
    if (CONJUNTO_VALIDO.has(id)) limpas.add(id);
  });
  return ordenar(Array.from(limpas));
};

/**
 * Acrescenta as dependências de cada permissão, recursivamente. Conceder
 * "tickets:delete" concede "tickets:view" junto: a alternativa é um cargo que
 * pode excluir uma conversa que não consegue abrir.
 */
export const comDependencias = (ids: string[]): Permission[] => {
  const resultado = new Set<string>();

  const incluir = (id: string, visitados: Set<string>) => {
    if (visitados.has(id) || !CONJUNTO_VALIDO.has(id)) return;
    visitados.add(id);
    resultado.add(id);
    INDICE.get(id)?.acao.requer?.forEach(dep => incluir(dep, visitados));
  };

  ids.forEach(id => incluir(normalizarPermissao(id), new Set()));
  return ordenar(Array.from(resultado));
};

/**
 * O inverso: ao tirar "tickets:view" de um cargo, "tickets:delete" e todo o
 * resto que dependia dela sai junto. Senão sobra permissão órfã gravada, que
 * não faz nada e confunde na próxima leitura.
 */
export const semDependentes = (
  ids: string[],
  removida: string
): Permission[] => {
  const restantes = new Set(ids.filter(id => id !== removida));
  let mudou = true;
  while (mudou) {
    mudou = false;
    restantes.forEach(id => {
      const requer = INDICE.get(id)?.acao.requer ?? [];
      if (requer.some(dep => !restantes.has(dep))) {
        restantes.delete(id);
        mudou = true;
      }
    });
  }
  return ordenar(Array.from(restantes));
};

/** As permissões de um módulo até determinado nível, inclusive. */
export const permissoesDoNivel = (
  moduloKey: string,
  nivel: Nivel
): Permission[] => {
  const modulo = MODULES[moduloKey];
  if (!modulo) return [];
  const limite = NIVEIS.indexOf(nivel);
  const ids = Object.entries(modulo.acoes)
    .filter(([, acao]) => NIVEIS.indexOf(acao.nivel) <= limite)
    .map(([acaoKey]) => `${moduloKey}:${acaoKey}`);
  return comDependencias(ids);
};
