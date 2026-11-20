import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import {
  Avatar,
  Button,
  ButtonBase,
  CircularProgress,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import AddIcon from "@mui/icons-material/Add";
import TagIcon from "@mui/icons-material/Tag";
import HeadsetMicOutlinedIcon from "@mui/icons-material/HeadsetMicOutlined";
import SendIcon from "@mui/icons-material/Send";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import HeadsetOffIcon from "@mui/icons-material/HeadsetOff";
import SearchIcon from "@mui/icons-material/Search";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import Janela from "../../components/Janela";
import ConfirmationModal from "../../components/ConfirmationModal";
import usePermissions from "../../hooks/usePermissions";
import { useTeamChat } from "../../context/TeamChat";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  BotaoFalar,
  ControlesDoRadio,
  StatusDoRadio,
  nomeDoCanal,
} from "../../components/TeamRadio";

/**
 * Equipe: o chat interno com rádio.
 *
 * À esquerda, a árvore de canais no jeito do Mumble — cada canal com quem
 * está na escuta pendurado embaixo, e quem está falando aceso. À direita, o
 * texto do canal e, quando a pessoa está no rádio dele, o botão de falar.
 *
 * Texto e voz são o mesmo canal: entrar no rádio de "Produção" é entrar na
 * sala onde o texto de "Produção" está escrito.
 */

const AGRUPAR_MS = 5 * 60 * 1000;

const iniciais = (nome = "") =>
  nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

const corDoNome = (nome = "") => {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) % 360;
  return `hsl(${h}, 45%, 48%)`;
};

const rotuloDoDia = (data) => {
  if (isToday(data)) return "Hoje";
  if (isYesterday(data)) return "Ontem";
  return format(data, "EEEE, d 'de' MMMM", { locale: ptBR });
};

const useStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;
  return {
    root: {
      flex: 1,
      minHeight: 0,
      height: "100%",
      display: "grid",
      gridTemplateColumns: "300px minmax(0, 1fr)",
      overflow: "hidden",
      [theme.breakpoints.down("md")]: { gridTemplateColumns: "minmax(0, 1fr)" },
    },
    lateral: {
      minHeight: 0,
      borderRight: `1px solid ${c.linha}`,
      backgroundColor: c.superficie,
      display: "flex",
      flexDirection: "column",
    },
    lateralComCanal: { [theme.breakpoints.down("md")]: { display: "none" } },
    principalSemCanal: { [theme.breakpoints.down("md")]: { display: "none" } },
    lateralTopo: {
      padding: "16px 16px 8px",
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    titulo: { flex: 1, fontWeight: 700, fontSize: "1.15rem", color: c.texto },
    busca: {
      margin: "0 12px 8px",
      padding: "4px 10px",
      borderRadius: 10,
      backgroundColor: c.hover,
      display: "flex",
      alignItems: "center",
      gap: 6,
      color: c.textoApagado,
      "& input": { fontSize: "0.85rem" },
    },
    lista: {
      flex: 1,
      overflowY: "auto",
      padding: "0 8px 16px",
      ...theme.scrollbarStyles,
    },
    secao: {
      display: "flex",
      alignItems: "center",
      padding: "14px 8px 4px",
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: ".06em",
      textTransform: "uppercase",
      color: c.textoApagado,
    },
    secaoTexto: { flex: 1 },
    item: {
      width: "100%",
      borderRadius: 8,
      padding: "6px 8px",
      display: "flex",
      alignItems: "center",
      gap: 8,
      justifyContent: "flex-start",
      color: c.textoApagado,
      fontSize: "0.88rem",
      textAlign: "left",
      "&:hover": { backgroundColor: c.hover, color: c.texto },
      "&:hover $acaoRadio": { opacity: 1 },
    },
    itemAtivo: {
      backgroundColor: c.primariaSuave,
      color: c.primariaSuaveTexto,
      "&:hover": { backgroundColor: c.primariaSuave, color: c.primariaSuaveTexto },
    },
    itemNaoLido: { color: c.texto, fontWeight: 700 },
    itemNome: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    contador: {
      minWidth: 20,
      height: 20,
      padding: "0 6px",
      borderRadius: 10,
      backgroundColor: c.sinal,
      color: c.sinalTexto,
      fontSize: "0.7rem",
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    acaoRadio: {
      opacity: 0,
      transition: "opacity .12s",
      padding: 4,
      [theme.breakpoints.down("md")]: { opacity: 1 },
    },
    acaoRadioAtiva: { opacity: 1, color: c.sucesso },
    ouvintes: { margin: "0 0 4px 28px", display: "flex", flexDirection: "column", gap: 1 },
    ouvinte: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: "0.8rem",
      color: c.textoApagado,
      padding: "2px 6px",
      borderRadius: 6,
    },
    ouvinteFalando: { color: c.texto, fontWeight: 600 },
    miniAvatar: {
      width: 20,
      height: 20,
      fontSize: "0.6rem",
      fontWeight: 700,
      boxSizing: "content-box",
      border: "2px solid transparent",
    },
    miniAvatarFalando: { borderColor: c.sucesso, boxShadow: `0 0 0 2px ${c.sucessoSuave}` },
    iconeMinusculo: { fontSize: 14, color: c.erro },
    bolinha: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    online: { backgroundColor: c.sucesso },
    offline: { backgroundColor: c.linhaForte },
    principal: {
      minWidth: 0,
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      backgroundColor: c.fundoConversa,
    },
    cabecalho: {
      backgroundColor: c.superficie,
      borderBottom: `1px solid ${c.linha}`,
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    cabecalhoNome: { flex: 1, minWidth: 160 },
    nomeCanal: { fontWeight: 700, color: c.texto, fontSize: "1rem" },
    topico: { fontSize: "0.8rem", color: c.textoApagado },
    painelRadio: {
      backgroundColor: c.superficie,
      borderBottom: `1px solid ${c.linha}`,
      padding: "10px 16px",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 360px)",
      alignItems: "center",
      gap: 12,
      [theme.breakpoints.down("sm")]: { gridTemplateColumns: "minmax(0, 1fr)" },
    },
    painelRadioInfo: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
    avisoRadio: { fontSize: "0.75rem", color: c.atencao, gridColumn: "1 / -1" },
    mensagens: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      padding: "12px 16px",
      ...theme.scrollbarStyles,
    },
    dia: {
      display: "flex",
      justifyContent: "center",
      margin: "16px 0 8px",
      "& span": {
        fontSize: "0.72rem",
        fontWeight: 600,
        color: c.textoApagado,
        backgroundColor: c.superficie,
        border: `1px solid ${c.linha}`,
        borderRadius: 12,
        padding: "2px 10px",
        textTransform: "capitalize",
      },
    },
    grupo: { display: "flex", gap: 10, marginTop: 10 },
    grupoCorpo: { flex: 1, minWidth: 0 },
    autor: { fontWeight: 700, fontSize: "0.85rem", color: c.texto, marginRight: 8 },
    hora: { fontSize: "0.72rem", color: c.textoApagado },
    mensagem: {
      position: "relative",
      padding: "2px 70px 2px 0",
      borderRadius: 6,
      color: c.texto,
      fontSize: "0.9rem",
      lineHeight: 1.45,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      "&:hover": { backgroundColor: c.hover },
      "&:hover $acoesMensagem": { display: "flex" },
    },
    apagada: { fontStyle: "italic", color: c.textoApagado },
    editada: { fontSize: "0.7rem", color: c.textoApagado, marginLeft: 6 },
    acoesMensagem: {
      display: "none",
      position: "absolute",
      right: 4,
      top: -2,
      backgroundColor: c.superficie,
      border: `1px solid ${c.linha}`,
      borderRadius: 8,
      "& button": { padding: 4 },
    },
    carregarMais: { display: "flex", justifyContent: "center", padding: 8 },
    vazio: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      color: c.textoApagado,
      textAlign: "center",
      padding: 24,
    },
    composer: {
      backgroundColor: c.superficie,
      borderTop: `1px solid ${c.linha}`,
      padding: "10px 12px",
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
    },
    campo: {
      flex: 1,
      backgroundColor: c.hover,
      borderRadius: 12,
      padding: "8px 12px",
      fontSize: "0.9rem",
      maxHeight: 160,
      overflowY: "auto",
    },
    edicao: { display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" },
    edicaoAcoes: { display: "flex", gap: 6, justifyContent: "flex-end" },
  };
});

// ── Lateral ────────────────────────────────────────────────────────────────

const OuvintesDoCanal = ({ sala }) => {
  const classes = useStyles();
  if (!sala || !sala.membros?.length) return null;
  return (
    <div className={classes.ouvintes}>
      {sala.membros.map((m) => {
        const falando = sala.falando?.userId === m.userId;
        return (
          <div key={m.userId} className={`${classes.ouvinte} ${falando ? classes.ouvinteFalando : ""}`}>
            <Avatar
              className={`${classes.miniAvatar} ${falando ? classes.miniAvatarFalando : ""}`}
              style={{ backgroundColor: corDoNome(m.name) }}
            >
              {iniciais(m.name)}
            </Avatar>
            <span className={classes.itemNome}>{m.name}</span>
            {m.deaf ? (
              <HeadsetOffIcon className={classes.iconeMinusculo} />
            ) : m.muted ? (
              <MicOffIcon className={classes.iconeMinusculo} />
            ) : falando ? (
              <MicIcon style={{ fontSize: 14 }} color="success" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

const ItemDeCanal = ({ canal, ativo, onAbrir }) => {
  const classes = useStyles();
  const { salas, radio, entrarNoRadio, sairDoRadio } = useTeamChat();
  const sala = salas[canal.id];
  const noRadio = radio.channelId === canal.id && radio.estado !== "fora";
  const naoLido = canal.unread > 0 && !ativo;
  const ehDireta = canal.kind === "direct";

  return (
    <>
      <ButtonBase
        component="div"
        role="button"
        tabIndex={0}
        className={`${classes.item} ${ativo ? classes.itemAtivo : ""} ${naoLido ? classes.itemNaoLido : ""}`}
        onClick={() => onAbrir(canal.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onAbrir(canal.id);
        }}
      >
        {ehDireta ? (
          <span className={`${classes.bolinha} ${canal.peer?.online ? classes.online : classes.offline}`} />
        ) : (
          <TagIcon style={{ fontSize: 16 }} />
        )}
        <span className={classes.itemNome}>{ehDireta ? canal.peer?.name : canal.name}</span>
        {naoLido && <span className={classes.contador}>{canal.unread > 99 ? "99+" : canal.unread}</span>}
        <Tooltip title={noRadio ? "Sair do rádio" : "Entrar no rádio deste canal"}>
          <IconButton
            size="small"
            className={`${classes.acaoRadio} ${noRadio || sala ? classes.acaoRadioAtiva : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (noRadio) sairDoRadio();
              else entrarNoRadio(canal.id);
            }}
            aria-label={noRadio ? "Sair do rádio" : "Entrar no rádio"}
          >
            <HeadsetMicOutlinedIcon style={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </ButtonBase>
      <OuvintesDoCanal sala={sala} />
    </>
  );
};

// ── Mensagens ──────────────────────────────────────────────────────────────

const Mensagem = ({ mensagem, minha, podeModerar, onEditar, onApagar }) => {
  const classes = useStyles();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(mensagem.body);

  const apagada = !!mensagem.deletedAt;

  const salvar = async () => {
    const limpo = texto.trim();
    if (!limpo || limpo === mensagem.body) {
      setEditando(false);
      return;
    }
    const ok = await onEditar(mensagem, limpo);
    if (ok) setEditando(false);
  };

  if (editando) {
    return (
      <div className={classes.edicao}>
        <TextField
          autoFocus
          multiline
          size="small"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              salvar();
            }
            if (e.key === "Escape") setEditando(false);
          }}
        />
        <div className={classes.edicaoAcoes}>
          <Button size="small" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
          <Button size="small" variant="contained" onClick={salvar}>
            Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${classes.mensagem} ${apagada ? classes.apagada : ""}`}>
      {apagada ? "mensagem apagada" : mensagem.body}
      {!apagada && mensagem.editedAt && <span className={classes.editada}>(editada)</span>}
      {!apagada && (minha || podeModerar) && (
        <div className={classes.acoesMensagem}>
          {minha && (
            <Tooltip title="Editar">
              <IconButton
                size="small"
                onClick={() => {
                  setTexto(mensagem.body);
                  setEditando(true);
                }}
              >
                <EditOutlinedIcon style={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Apagar">
            <IconButton size="small" onClick={() => onApagar(mensagem)}>
              <DeleteOutlineIcon style={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

/** Junta mensagens seguidas da mesma pessoa, e separa por dia. */
const agrupar = (mensagens) => {
  const blocos = [];
  let anterior = null;
  mensagens.forEach((m) => {
    const data = new Date(m.createdAt);
    if (!anterior || !isSameDay(new Date(anterior.createdAt), data)) {
      blocos.push({ tipo: "dia", chave: `dia-${m.id}`, data });
      anterior = null;
    }
    const continua =
      anterior &&
      anterior.userId === m.userId &&
      data - new Date(anterior.createdAt) < AGRUPAR_MS;
    if (continua) {
      blocos[blocos.length - 1].mensagens.push(m);
    } else {
      blocos.push({ tipo: "grupo", chave: `g-${m.id}`, autor: m.user, userId: m.userId, data, mensagens: [m] });
    }
    anterior = m;
  });
  return blocos;
};

// ── Janela de canal ────────────────────────────────────────────────────────

const JanelaDeCanal = ({ open, canal, onClose, onSalvo }) => {
  const [nome, setNome] = useState("");
  const [topico, setTopico] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(canal?.name || "");
    setTopico(canal?.topic || "");
  }, [open, canal]);

  const salvar = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const corpo = { name: nome, topic: topico };
      const { data } = canal
        ? await api.put(`/team-chat/channels/${canal.id}`, corpo)
        : await api.post("/team-chat/channels", corpo);
      onSalvo(data);
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Janela
      open={open}
      onClose={onClose}
      titulo={canal ? "Editar canal" : "Novo canal"}
      subtitulo="Cada canal tem texto e rádio. Todos da empresa enxergam."
      icone={<TagIcon />}
      tamanho="xs"
      rotuloConfirmar={canal ? "Salvar" : "Criar canal"}
      onSubmit={salvar}
      carregando={salvando}
      confirmarDesabilitado={!nome.trim()}
    >
      <TextField
        autoFocus
        fullWidth
        label="Nome"
        value={nome}
        inputProps={{ maxLength: 60 }}
        onChange={(e) => setNome(e.target.value)}
        margin="dense"
      />
      <TextField
        fullWidth
        label="Assunto (opcional)"
        value={topico}
        inputProps={{ maxLength: 200 }}
        onChange={(e) => setTopico(e.target.value)}
        margin="dense"
      />
    </Janela>
  );
};

// ── Tela ───────────────────────────────────────────────────────────────────

const TeamChat = () => {
  const classes = useStyles();
  const history = useHistory();
  const { channelId: parametro } = useParams();
  const channelId = parametro ? Number(parametro) : null;
  const { user } = useContext(AuthContext);
  const meuId = Number(user?.id);
  const { can } = usePermissions();
  const podeGerenciar = can("teamChat:manage");

  const {
    canais,
    pessoas,
    radio,
    aviso,
    carregarCanais,
    assinar,
    definirCanalAberto,
    marcarComoLido,
    entrarNoRadio,
  } = useTeamChat();

  const [busca, setBusca] = useState("");
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [temMais, setTemMais] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [janelaCanal, setJanelaCanal] = useState({ open: false, canal: null });
  const [menuCanal, setMenuCanal] = useState(null);
  const [arquivar, setArquivar] = useState(null);
  const [apagar, setApagar] = useState(null);

  const rolagemRef = useRef(null);
  const colarNoFimRef = useRef(true);
  const alturaAntesRef = useRef(null);
  const campoRef = useRef(null);

  const canal = canais.find((c) => c.id === channelId) || null;
  const abertos = canais.filter((c) => c.kind === "channel");
  const diretas = canais
    .filter((c) => c.kind === "direct")
    .sort((a, b) => (b.lastMessageId || 0) - (a.lastMessageId || 0));

  const filtro = busca.trim().toLowerCase();
  const casa = (nome) => !filtro || (nome || "").toLowerCase().includes(filtro);
  const pessoasSemConversa = useMemo(() => {
    const comConversa = new Set(diretas.map((d) => d.peer?.id));
    return pessoas
      .filter((p) => p.id !== meuId && !comConversa.has(p.id))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  }, [pessoas, diretas, meuId]);

  // Sem canal na URL, abre o primeiro (no computador; no celular a lista é a tela).
  useEffect(() => {
    if (channelId || !abertos.length) return;
    if (window.matchMedia("(min-width: 900px)").matches) {
      history.replace(`/equipe/${abertos[0].id}`);
    }
  }, [channelId, abertos, history]);

  // Canal que sumiu (arquivado, ou link para um que não é seu): volta à lista.
  useEffect(() => {
    if (channelId && canais.length && !canal) history.replace("/equipe");
  }, [channelId, canais, canal, history]);

  useEffect(() => {
    definirCanalAberto(channelId);
    return () => definirCanalAberto(null);
  }, [channelId, definirCanalAberto]);

  // ── Carregar mensagens ──

  useEffect(() => {
    if (!channelId) return undefined;
    let cancelado = false;
    setMensagens([]);
    setTemMais(false);
    setCarregando(true);
    colarNoFimRef.current = true;
    api
      .get(`/team-chat/channels/${channelId}/messages`)
      .then(({ data }) => {
        if (cancelado) return;
        setMensagens(data);
        setTemMais(data.length >= 50);
        marcarComoLido(channelId);
      })
      .catch((err) => {
        if (!cancelado) toastError(err);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [channelId, marcarComoLido]);

  const carregarAnteriores = async () => {
    if (!mensagens.length || carregando) return;
    setCarregando(true);
    alturaAntesRef.current = rolagemRef.current?.scrollHeight || null;
    try {
      const { data } = await api.get(`/team-chat/channels/${channelId}/messages`, {
        params: { before: mensagens[0].id },
      });
      setMensagens((atual) => [...data, ...atual]);
      setTemMais(data.length >= 50);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  };

  // ── Tempo real ──

  useEffect(
    () =>
      assinar((evento) => {
        const m = evento?.message;
        if (!m || m.channelId !== channelId) return;
        if (evento.action === "create") {
          setMensagens((atual) => (atual.some((x) => x.id === m.id) ? atual : [...atual, m]));
          if (Number(m.userId) !== meuId && !document.hidden) marcarComoLido(channelId);
        } else {
          setMensagens((atual) => atual.map((x) => (x.id === m.id ? m : x)));
        }
      }),
    [assinar, channelId, meuId, marcarComoLido]
  );

  // Voltando para a aba, o que chegou enquanto ela estava escondida é lido.
  useEffect(() => {
    if (!channelId) return undefined;
    const voltou = () => {
      if (!document.hidden && canais.find((c) => c.id === channelId)?.unread) marcarComoLido(channelId);
    };
    document.addEventListener("visibilitychange", voltou);
    return () => document.removeEventListener("visibilitychange", voltou);
  }, [channelId, canais, marcarComoLido]);

  // ── Rolagem ──

  useLayoutEffect(() => {
    const el = rolagemRef.current;
    if (!el) return;
    if (alturaAntesRef.current !== null) {
      // Carregou anteriores: mantém na tela a mensagem que estava no topo.
      el.scrollTop = el.scrollHeight - alturaAntesRef.current;
      alturaAntesRef.current = null;
      return;
    }
    if (colarNoFimRef.current) el.scrollTop = el.scrollHeight;
  }, [mensagens]);

  const aoRolar = () => {
    const el = rolagemRef.current;
    if (!el) return;
    colarNoFimRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // ── Ações ──

  const abrir = useCallback((id) => history.push(`/equipe/${id}`), [history]);

  const conversarCom = async (pessoa) => {
    try {
      const { data } = await api.post(`/team-chat/direct/${pessoa.id}`);
      await carregarCanais();
      abrir(data.id);
    } catch (err) {
      toastError(err);
    }
  };

  const enviar = async () => {
    const corpo = texto.trim();
    if (!corpo || !channelId || enviando) return;
    setEnviando(true);
    colarNoFimRef.current = true;
    try {
      const { data } = await api.post(`/team-chat/channels/${channelId}/messages`, { body: corpo });
      setMensagens((atual) => (atual.some((x) => x.id === data.id) ? atual : [...atual, data]));
      setTexto("");
    } catch (err) {
      toastError(err);
    } finally {
      setEnviando(false);
      campoRef.current?.focus();
    }
  };

  const editar = async (mensagem, corpo) => {
    try {
      const { data } = await api.put(`/team-chat/messages/${mensagem.id}`, { body: corpo });
      setMensagens((atual) => atual.map((x) => (x.id === data.id ? data : x)));
      return true;
    } catch (err) {
      toastError(err);
      return false;
    }
  };

  const confirmarApagar = async () => {
    const alvo = apagar;
    if (!alvo) return;
    try {
      await api.delete(`/team-chat/messages/${alvo.id}`);
      setMensagens((atual) =>
        atual.map((x) => (x.id === alvo.id ? { ...x, body: "", deletedAt: new Date().toISOString() } : x))
      );
    } catch (err) {
      toastError(err);
    }
  };

  const confirmarArquivar = async () => {
    const alvo = arquivar;
    if (!alvo) return;
    try {
      await api.delete(`/team-chat/channels/${alvo.id}`);
      await carregarCanais();
      history.replace("/equipe");
    } catch (err) {
      toastError(err);
    }
  };

  const noRadioDeste = canal && radio.channelId === canal.id && radio.estado !== "fora";
  const blocos = useMemo(() => agrupar(mensagens), [mensagens]);

  return (
    <div className={classes.root}>
      <aside className={`${classes.lateral} ${channelId ? classes.lateralComCanal : ""}`}>
        <div className={classes.lateralTopo}>
          <span className={classes.titulo}>Equipe</span>
          {podeGerenciar && (
            <Tooltip title="Novo canal">
              <IconButton size="small" onClick={() => setJanelaCanal({ open: true, canal: null })}>
                <AddIcon />
              </IconButton>
            </Tooltip>
          )}
        </div>
        <div className={classes.busca}>
          <SearchIcon fontSize="small" />
          <InputBase
            placeholder="Buscar canal ou pessoa"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            fullWidth
            inputProps={{ "aria-label": "Buscar canal ou pessoa" }}
          />
        </div>

        <div className={classes.lista}>
          <div className={classes.secao}>
            <span className={classes.secaoTexto}>Canais</span>
          </div>
          {abertos
            .filter((c) => casa(c.name))
            .map((c) => (
              <ItemDeCanal key={c.id} canal={c} ativo={c.id === channelId} onAbrir={abrir} />
            ))}

          {diretas.filter((c) => casa(c.peer?.name)).length > 0 && (
            <div className={classes.secao}>
              <span className={classes.secaoTexto}>Conversas</span>
            </div>
          )}
          {diretas
            .filter((c) => casa(c.peer?.name))
            .map((c) => (
              <ItemDeCanal key={c.id} canal={c} ativo={c.id === channelId} onAbrir={abrir} />
            ))}

          {pessoasSemConversa.filter((p) => casa(p.name)).length > 0 && (
            <div className={classes.secao}>
              <span className={classes.secaoTexto}>Pessoas</span>
            </div>
          )}
          {pessoasSemConversa
            .filter((p) => casa(p.name))
            .map((p) => (
              <ButtonBase key={p.id} className={classes.item} onClick={() => conversarCom(p)}>
                <span className={`${classes.bolinha} ${p.online ? classes.online : classes.offline}`} />
                <span className={classes.itemNome}>{p.name}</span>
              </ButtonBase>
            ))}
        </div>
      </aside>

      <section className={`${classes.principal} ${!channelId ? classes.principalSemCanal : ""}`}>
        {!canal ? (
          <div className={classes.vazio}>
            <ForumOutlinedIcon style={{ fontSize: 48 }} />
            <Typography variant="body2">Escolha um canal ou uma pessoa para conversar.</Typography>
          </div>
        ) : (
          <>
            <header className={classes.cabecalho}>
              <IconButton
                size="small"
                onClick={() => history.push("/equipe")}
                sx={{ display: { md: "none" } }}
                aria-label="Voltar para a lista"
              >
                <ArrowBackIcon />
              </IconButton>
              <div className={classes.cabecalhoNome}>
                <div className={classes.nomeCanal}>{nomeDoCanal(canal)}</div>
                {canal.kind === "direct" ? (
                  <div className={classes.topico}>{canal.peer?.online ? "Online agora" : "Offline"}</div>
                ) : canal.topic ? (
                  <div className={classes.topico}>{canal.topic}</div>
                ) : null}
              </div>
              {!noRadioDeste && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<HeadsetMicOutlinedIcon />}
                  onClick={() => entrarNoRadio(canal.id)}
                >
                  {radio.estado !== "fora" ? "Trocar para este rádio" : "Entrar no rádio"}
                </Button>
              )}
              {podeGerenciar && canal.kind === "channel" && (
                <>
                  <IconButton size="small" onClick={(e) => setMenuCanal(e.currentTarget)} aria-label="Opções do canal">
                    <MoreVertIcon />
                  </IconButton>
                  <Menu anchorEl={menuCanal} open={Boolean(menuCanal)} onClose={() => setMenuCanal(null)}>
                    <MenuItem
                      onClick={() => {
                        setMenuCanal(null);
                        setJanelaCanal({ open: true, canal });
                      }}
                    >
                      <ListItemIcon>
                        <EditOutlinedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Editar canal</ListItemText>
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setMenuCanal(null);
                        setArquivar(canal);
                      }}
                    >
                      <ListItemIcon>
                        <ArchiveOutlinedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Arquivar canal</ListItemText>
                    </MenuItem>
                  </Menu>
                </>
              )}
            </header>

            {noRadioDeste && (
              <div className={classes.painelRadio}>
                {radio.estado === "entrando" ? (
                  <Typography variant="body2" color="text.secondary">
                    Entrando no rádio…
                  </Typography>
                ) : (
                  <>
                    <div className={classes.painelRadioInfo}>
                      <StatusDoRadio />
                      <ControlesDoRadio />
                    </div>
                    <BotaoFalar />
                    {(aviso || radio.avisoMicrofone) && (
                      <div className={classes.avisoRadio}>{aviso || radio.avisoMicrofone}</div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className={classes.mensagens} ref={rolagemRef} onScroll={aoRolar}>
              {temMais && (
                <div className={classes.carregarMais}>
                  <Button size="small" onClick={carregarAnteriores} disabled={carregando}>
                    Carregar mensagens anteriores
                  </Button>
                </div>
              )}
              {carregando && !mensagens.length && (
                <div className={classes.carregarMais}>
                  <CircularProgress size={22} />
                </div>
              )}
              {!carregando && !mensagens.length && (
                <div className={classes.vazio}>
                  <Typography variant="body2">
                    {canal.kind === "direct"
                      ? `Comece a conversa com ${canal.peer?.name}.`
                      : "Nenhuma mensagem ainda. Diga oi para a equipe."}
                  </Typography>
                </div>
              )}
              {blocos.map((b) =>
                b.tipo === "dia" ? (
                  <div key={b.chave} className={classes.dia}>
                    <span>{rotuloDoDia(b.data)}</span>
                  </div>
                ) : (
                  <div key={b.chave} className={classes.grupo}>
                    <Avatar style={{ width: 34, height: 34, fontSize: 13, backgroundColor: corDoNome(b.autor?.name) }}>
                      {iniciais(b.autor?.name)}
                    </Avatar>
                    <div className={classes.grupoCorpo}>
                      <div>
                        <span className={classes.autor}>{b.autor?.name || "Ex-integrante"}</span>
                        <span className={classes.hora}>{format(b.data, "HH:mm")}</span>
                      </div>
                      {b.mensagens.map((m) => (
                        <Mensagem
                          key={m.id}
                          mensagem={m}
                          minha={Number(m.userId) === meuId}
                          podeModerar={podeGerenciar && canal.kind === "channel"}
                          onEditar={editar}
                          onApagar={setApagar}
                        />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className={classes.composer}>
              <InputBase
                inputRef={campoRef}
                className={classes.campo}
                multiline
                maxRows={6}
                placeholder={`Mensagem para ${nomeDoCanal(canal)}`}
                value={texto}
                inputProps={{ maxLength: 4000, "aria-label": "Escrever mensagem" }}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    enviar();
                  }
                }}
              />
              <IconButton color="primary" onClick={enviar} disabled={!texto.trim() || enviando} aria-label="Enviar">
                <SendIcon />
              </IconButton>
            </div>
          </>
        )}
      </section>

      <JanelaDeCanal
        open={janelaCanal.open}
        canal={janelaCanal.canal}
        onClose={() => setJanelaCanal({ open: false, canal: null })}
        onSalvo={(salvo) => {
          carregarCanais();
          if (!janelaCanal.canal && salvo?.id) abrir(salvo.id);
        }}
      />
      <ConfirmationModal
        open={Boolean(arquivar)}
        title={`Arquivar ${arquivar ? nomeDoCanal(arquivar) : ""}?`}
        onClose={() => setArquivar(null)}
        onConfirm={confirmarArquivar}
        confirmLabel="Arquivar"
        danger
      >
        O canal sai da lista de todos. As mensagens ficam guardadas.
      </ConfirmationModal>
      <ConfirmationModal
        open={Boolean(apagar)}
        title="Apagar mensagem?"
        onClose={() => setApagar(null)}
        onConfirm={confirmarApagar}
        confirmLabel="Apagar"
        danger
      >
        No lugar dela fica o aviso “mensagem apagada”, para todos.
      </ConfirmationModal>
    </div>
  );
};

export default TeamChat;
