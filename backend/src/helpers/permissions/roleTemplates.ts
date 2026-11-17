import { comDependencias, permissoesDoNivel, Permission } from "./catalog";

/**
 * Modelos de cargo.
 *
 * São pontos de partida oferecidos na tela ao criar um cargo, não linhas no
 * banco: o administrador escolhe um modelo, o editor abre com aquelas caixas
 * já marcadas, e a partir dali é um cargo comum da empresa, editável e
 * desvinculado do modelo. Assim ninguém herda em silêncio uma mudança que a
 * gente faça aqui depois.
 *
 * Os modelos são genéricos de propósito. O Unmess é um SaaS: um cargo de
 * "produção" ou "instalação" faz sentido para uma gráfica e nenhum para um
 * escritório de contabilidade. Quem precisa desses cargos os cria — a partir
 * de "Atendente", em dois cliques.
 */

/** O slug do único cargo que o sistema cria e protege sozinho. */
export const SLUG_ADMINISTRADOR = "administrador";

export interface ModeloDeCargo {
  slug: string;
  nome: string;
  descricao: string;
  permissions: Permission[];
}

const atendente = comDependencias([
  ...permissoesDoNivel("tickets", "operar"),
  ...permissoesDoNivel("contacts", "operar"),
  "tags:assign",
  ...permissoesDoNivel("quickAnswers", "ver"),
  "stickers:send"
]);

const vendedor = comDependencias([
  ...atendente,
  ...permissoesDoNivel("clients", "operar"),
  ...permissoesDoNivel("crm", "operar"),
  "products:view",
  "finance:view"
]);

const financeiro = comDependencias([
  ...permissoesDoNivel("finance", "gerenciar"),
  ...permissoesDoNivel("clients", "operar"),
  "crm:view",
  "products:view"
]);

const gerente = comDependencias([
  ...vendedor,
  "tickets:viewAll",
  "tickets:transfer",
  "crm:viewAll",
  ...permissoesDoNivel("crm", "gerenciar"),
  ...permissoesDoNivel("products", "gerenciar"),
  ...permissoesDoNivel("tags", "gerenciar"),
  ...permissoesDoNivel("quickAnswers", "gerenciar"),
  ...permissoesDoNivel("queues", "gerenciar"),
  ...permissoesDoNivel("dashboard", "ver"),
  ...permissoesDoNivel("users", "ver")
]);

export const MODELOS_DE_CARGO: ModeloDeCargo[] = [
  {
    slug: "atendente",
    nome: "Atendente",
    descricao:
      "Atende no WhatsApp: responde, encerra e etiqueta conversas das próprias filas. Não vê o atendimento das outras pessoas.",
    permissions: atendente
  },
  {
    slug: "vendedor",
    nome: "Vendedor",
    descricao:
      "Tudo do atendente, mais o funil: cria oportunidade, monta orçamento e cuida da ficha do cliente. Vê apenas os próprios negócios.",
    permissions: vendedor
  },
  {
    slug: "financeiro",
    nome: "Financeiro",
    descricao:
      "Cobra, dá baixa, estorna e acompanha o caixa. Enxerga o funil para saber o que foi vendido, mas não mexe nele.",
    permissions: financeiro
  },
  {
    slug: "gerente",
    nome: "Gerente",
    descricao:
      "Enxerga o trabalho de toda a equipe e configura funil, filas, etiquetas e produtos. Não mexe em cargos nem em conexões.",
    permissions: gerente
  }
];

export const buscarModelo = (slug: string): ModeloDeCargo | undefined =>
  MODELOS_DE_CARGO.find(m => m.slug === slug);
