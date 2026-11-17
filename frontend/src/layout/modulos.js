import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import ContactPhoneOutlinedIcon from "@mui/icons-material/ContactPhoneOutlined";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import GroupWorkOutlinedIcon from "@mui/icons-material/GroupWorkOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SecurityIcon from "@mui/icons-material/Security";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";

/**
 * O menu lateral, como dado.
 *
 * Antes cada item era um bloco de JSX escrito à mão dentro de um `if` de
 * permissão, e a seção inteira era outro `if` por cima — o que fazia com que
 * mover um item de lugar significasse recortar quinze linhas e torcer para
 * não deixar um `<>` órfão. Agora a barra é uma lista, e mudar a organização
 * dos módulos é mudar o campo `secao` de uma linha.
 *
 * A `chave` é o que os favoritos de cada pessoa guardam no banco. Ela é
 * estável de propósito: renomear um módulo na tela não pode desfavoritá-lo
 * para todo mundo. Chave que sai daqui vira favorito órfão, e o menu
 * simplesmente a ignora.
 */

export const SECOES = [
  { chave: "operation",  rotulo: "mainDrawer.sections.operation" },
  { chave: "commercial", rotulo: "mainDrawer.sections.commercial" },
  { chave: "finance",    rotulo: "mainDrawer.sections.finance" },
  { chave: "system",     rotulo: "mainDrawer.sections.system" },
  { chave: "platform",   rotulo: "mainDrawer.sections.platform" },
];

/**
 * Cada módulo declara:
 *   chave        identidade estável, usada pelos favoritos
 *   secao        em qual bloco aparece
 *   to           rota
 *   rotulo       chave de tradução
 *   Icone        componente do @mui/icons-material
 *   permissao    exigida para o item aparecer
 *   permissoes   alternativa a `permissao`: basta uma delas (canAny)
 *   superOnly    só o super-admin da plataforma vê
 */
export const MODULOS = [
  // ── Operação ──────────────────────────────────────────────────────────────
  {
    chave: "dashboard",
    secao: "operation",
    to: "/",
    rotulo: "mainDrawer.listItems.dashboard",
    Icone: DashboardOutlinedIcon,
    permissao: "dashboard:view",
  },
  {
    chave: "tickets",
    secao: "operation",
    to: "/tickets",
    rotulo: "mainDrawer.listItems.tickets",
    Icone: ForumOutlinedIcon,
    permissao: "tickets:view",
  },
  {
    // Contatos é a agenda de quem atende, não uma carteira de vendas: quem
    // usa é o mesmo que está na conversa ao lado. Estava em Comercial junto
    // de Clientes só pela semelhança do nome.
    chave: "contacts",
    secao: "operation",
    to: "/contacts",
    rotulo: "mainDrawer.listItems.contacts",
    Icone: ContactPhoneOutlinedIcon,
    permissao: "contacts:view",
  },

  // ── Comercial ─────────────────────────────────────────────────────────────
  {
    chave: "crm",
    secao: "commercial",
    to: "/crm",
    rotulo: "mainDrawer.listItems.crm",
    Icone: ViewKanbanOutlinedIcon,
    permissao: "crm:view",
  },
  {
    chave: "customers",
    secao: "commercial",
    to: "/customers",
    rotulo: "mainDrawer.listItems.customers",
    Icone: GroupWorkOutlinedIcon,
    permissao: "clients:view",
  },

  // ── Financeiro ────────────────────────────────────────────────────────────
  //
  // Era um item só, "Financeiro", abrindo uma tela com quatro abas. Virou
  // cinco módulos porque as abas nunca foram quatro vistas do mesmo assunto:
  // elas têm permissões diferentes, donos diferentes e frequências de uso
  // diferentes. Quem lança contas a pagar abre a mesma tela todo dia; quem
  // olha o resultado abre uma vez por mês; e a permissão de ver o retrato do
  // negócio inteiro não é a de conferir se o cliente pagou.
  //
  // Com módulos separados, cada um aparece só para quem o alcança, e quem usa
  // um deles todo dia pode fixá-lo em Favoritos sem levar os outros junto.
  {
    // O PDV vem primeiro da seção: quem opera o balcão abre esta tela e mais
    // nenhuma, e ela é a única do financeiro usada o dia inteiro.
    chave: "finance-pdv",
    secao: "finance",
    to: "/finance/pdv",
    rotulo: "mainDrawer.listItems.financePos",
    Icone: PointOfSaleOutlinedIcon,
    permissao: "finance:pos",
  },
  {
    chave: "finance-metricas",
    secao: "finance",
    to: "/finance/metricas",
    rotulo: "mainDrawer.listItems.financeMetrics",
    Icone: InsightsOutlinedIcon,
    // Mesma permissão do fluxo de caixa: as duas telas são o retrato
    // financeiro do negócio inteiro, não o recorte de um atendimento.
    permissao: "finance:cashflow",
  },
  {
    chave: "finance-receber",
    secao: "finance",
    to: "/finance/receber",
    rotulo: "mainDrawer.listItems.financeReceivables",
    Icone: ReceiptLongOutlinedIcon,
    permissao: "finance:view",
  },
  {
    chave: "finance-pagar",
    secao: "finance",
    to: "/finance/pagar",
    rotulo: "mainDrawer.listItems.financePayables",
    Icone: PaymentsOutlinedIcon,
    permissao: "finance:view",
  },
  {
    chave: "finance-caixa",
    secao: "finance",
    to: "/finance/caixa",
    rotulo: "mainDrawer.listItems.financeCashflow",
    Icone: AccountBalanceWalletOutlinedIcon,
    permissao: "finance:cashflow",
  },
  {
    chave: "finance-configuracao",
    secao: "finance",
    to: "/finance/configuracao",
    rotulo: "mainDrawer.listItems.financeSettings",
    Icone: TuneOutlinedIcon,
    permissao: "finance:manage",
  },

  // ── Administração do sistema ──────────────────────────────────────────────
  {
    chave: "cadastros",
    secao: "system",
    to: "/cadastros",
    rotulo: "mainDrawer.listItems.cadastros",
    Icone: LibraryBooksOutlinedIcon,
    // Cinco abas com cinco permissões diferentes: quem alcança qualquer uma
    // delas entra, e lá dentro vê só as que lhe cabem.
    permissoes: [
      "products:view",
      "quickAnswers:view",
      "tags:view",
      "settings:view",
    ],
  },
  {
    chave: "users",
    secao: "system",
    to: "/users",
    rotulo: "mainDrawer.listItems.users",
    Icone: PeopleAltOutlinedIcon,
    permissao: "users:view",
  },
  {
    chave: "roles",
    secao: "system",
    to: "/roles",
    rotulo: "mainDrawer.listItems.roles",
    Icone: SecurityIcon,
    permissao: "roles:view",
  },
  {
    chave: "queues",
    secao: "system",
    to: "/Queues",
    rotulo: "mainDrawer.listItems.queues",
    Icone: AccountTreeOutlinedIcon,
    permissao: "queues:view",
  },
  {
    chave: "settings",
    secao: "system",
    to: "/Settings",
    rotulo: "mainDrawer.listItems.settings",
    Icone: SettingsOutlinedIcon,
    // Conexões vive dentro de Configurações e tem permissão própria: quem
    // cuida só dos números também entra.
    permissoes: ["settings:view", "connections:view"],
    // O alerta de número caído mora neste item, para quem cuida das conexões
    // ver o problema sem abrir a tela.
    alerta: "conexoes",
  },

  // ── Plataforma ────────────────────────────────────────────────────────────
  {
    chave: "companies",
    secao: "platform",
    to: "/companies",
    rotulo: "mainDrawer.listItems.companies",
    Icone: BusinessOutlinedIcon,
    superOnly: true,
  },
];
