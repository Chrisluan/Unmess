import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";

export const ABAS_CONFIGURACOES = ["geral", "conexoes", "horarios", "status", "etiquetas", "mensagens", "marca", "saude"];

export const SECOES_AJUSTES = [
  {
    titulo: "Atendimento",
    itens: [
      { rotulo: "Números de WhatsApp", para: "/Settings?aba=conexoes", permissao: "connections:view", Icone: WhatsAppIcon },
      { rotulo: "Filas", para: "/Queues", permissao: "queues:view", Icone: AccountTreeOutlinedIcon },
      { rotulo: "Respostas rápidas", para: "/quickAnswers", permissao: "quickAnswers:view", Icone: BoltOutlinedIcon },
      { rotulo: "Etiquetas", para: "/Settings?aba=etiquetas", permissao: "tags:view", Icone: LocalOfferOutlinedIcon },
      { rotulo: "Horário de atendimento", para: "/Settings?aba=horarios", permissao: "settings:view", Icone: ScheduleOutlinedIcon },
      { rotulo: "Motivos de encerramento", para: "/Settings?aba=status", permissao: "settings:view", Icone: TaskAltOutlinedIcon },
      { rotulo: "Mensagens automáticas", para: "/Settings?aba=mensagens", permissao: "settings:view", Icone: SmsOutlinedIcon }
    ]
  },
  {
    titulo: "Vendas",
    itens: [
      { rotulo: "Produtos", para: "/products", permissao: "products:view", Icone: Inventory2OutlinedIcon }
    ]
  },
  {
    titulo: "Equipe",
    itens: [
      { rotulo: "Usuários", para: "/users", permissao: "users:view", Icone: PeopleAltOutlinedIcon },
      { rotulo: "Cargos e permissões", para: "/roles", permissao: "roles:view", Icone: ShieldOutlinedIcon }
    ]
  },
  {
    titulo: "Conta",
    itens: [
      { rotulo: "Geral", para: "/Settings?aba=geral", permissao: "settings:view", Icone: TuneOutlinedIcon },
      { rotulo: "Identidade visual", para: "/Settings?aba=marca", permissao: "settings:view", Icone: PaletteOutlinedIcon },
      { rotulo: "Saúde da configuração", para: "/Settings?aba=saude", permissao: "settings:view", Icone: RuleOutlinedIcon }
    ]
  },
  {
    titulo: "Plataforma",
    apenasSuper: true,
    itens: [
      { rotulo: "Empresas", para: "/companies", Icone: BusinessOutlinedIcon }
    ]
  }
];

export const ROTAS_AJUSTES = ["/settings", "/queues", "/quickanswers", "/products", "/users", "/roles", "/companies"];

export const ehRotaDeAjustes = (pathname) =>
  ROTAS_AJUSTES.some((rota) => pathname.toLowerCase().startsWith(rota));

export const secoesVisiveis = ({ can, ehSuper }) =>
  SECOES_AJUSTES.filter((secao) => !secao.apenasSuper || ehSuper)
    .map((secao) => ({
      ...secao,
      itens: secao.itens.filter((item) => !item.permissao || can(item.permissao))
    }))
    .filter((secao) => secao.itens.length > 0);

export const itemAtivo = (item, { pathname, search }) => {
  const [caminho, consulta] = item.para.split("?");
  if (pathname.toLowerCase() !== caminho.toLowerCase()) return false;
  if (!consulta) return true;
  const esperado = new URLSearchParams(consulta).get("aba");
  const atual = new URLSearchParams(search).get("aba") || "geral";
  return esperado === atual;
};
