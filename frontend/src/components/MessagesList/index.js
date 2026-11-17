import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useHistory, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import { isSameDay, parseISO, format } from "date-fns";
import openSocket from "../../services/socket-io";
import clsx from "clsx";

import {
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputBase,
  Tooltip,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import {
  AccessTime,
  Block,
  Close as CloseIcon,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
  PhoneAndroid,
  Search as SearchIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  ArrowDownward as ArrowDownwardIcon,
  ErrorOutline as ErrorOutlineIcon,
  InsertDriveFileOutlined as InsertDriveFileIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
} from "@mui/icons-material";

import { i18n } from "../../translate/i18n";
import MarkdownWrapper from "../MarkdownWrapper";
import VcardPreview from "../VcardPreview";
import LocationPreview from "../LocationPreview";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import EmptyState from "../EmptyState";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import Audio from "../Audio";
import { messageDate } from "../../helpers/messageDate";
import { mediaUrl } from "../../helpers/mediaUrl";
import { useOutgoingMessages } from "../../context/OutgoingMessages/OutgoingMessagesContext";

const useStyles = makeStyles((theme) => ({
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },

  /**
   * Fundo liso, da cor da página.
   *
   * O rabisco do WhatsApp brigava com o texto das mensagens e trazia 700 KB de
   * PNG para dentro do bundle de uma instalação que roda em rede local. O que
   * separa mensagem de fundo aqui é o próprio balão.
   */
  messagesList: {
    backgroundColor: theme.palette.unmess.fundoConversa,
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "20px 6% 16px",
    gap: 4,
    overflowY: "scroll",
    [theme.breakpoints.down('md')]: {
      padding: "16px 10px 12px",
    },
    ...theme.scrollbarStyles,
  },

  /**
   * Volta para o fim da conversa.
   *
   * Flutua acima da lista, encostado no canto onde a última mensagem aparece.
   * Some quando a pessoa já está no fim: um botão permanente que não faz nada
   * é ruído em uma tela usada o dia inteiro.
   */
  irParaFim: {
    position: "absolute",
    right: 20,
    bottom: 16,
    zIndex: 5,
    boxShadow: theme.shadows[3],
    whiteSpace: "nowrap",
  },

  circleLoading: {
    color: theme.palette.unmess.primaria,
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  messageLeft: {
    marginRight: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: theme.palette.unmess.balaoRecebido,
    color: theme.palette.unmess.texto,
    alignSelf: "flex-start",
    borderRadius: 14,
    borderTopLeftRadius: 4,
    fontSize: "0.9375rem",
    lineHeight: 1.5,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 6,
    paddingBottom: 0,
    boxShadow: theme.palette.unmess.sombra,
  },

  quotedContainerLeft: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: theme.palette.unmess.superficie2,
    borderRadius: 10,
    display: "flex",
    position: "relative",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: theme.palette.unmess.textoApagado,
  },

  messageRight: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: theme.palette.unmess.balaoEnviado,
    color: theme.palette.unmess.texto,
    alignSelf: "flex-end",
    borderRadius: 14,
    borderTopRightRadius: 4,
    fontSize: "0.9375rem",
    lineHeight: 1.5,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 6,
    paddingBottom: 0,
    boxShadow: theme.palette.unmess.sombra,
  },

  quotedContainerRight: {
    margin: "-3px -80px 6px -6px",
    overflowY: "hidden",
    backgroundColor: theme.palette.unmess.primariaSuave,
    borderRadius: 10,
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: theme.palette.unmess.primaria,
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: theme.palette.unmess.textoApagado,
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  // Nome de quem falou dentro do grupo: precisa distinguir participantes sem
  // virar destaque, por isso peso e não cor forte.
  messageContactName: {
    display: "flex",
    color: theme.palette.unmess.primariaSuaveTexto,
    fontWeight: 600,
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  // Apagada continua legível, só apagada: o cinza fixo sumia por completo no
  // modo escuro e dentro do balão azul.
  textContentItemDeleted: {
    fontStyle: "italic",
    color: theme.palette.unmess.textoApagado,
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  messageMedia: {
    objectFit: "cover",
    width: 250,
    height: 200,
  },

  // Figurinha não é foto: no WhatsApp ela aparece solta, com fundo
  // transparente e sem moldura. Daí não ter borda arredondada nem recorte --
  // "contain" preserva o desenho inteiro, enquanto "cover" cortaria as pontas.
  messageSticker: {
    objectFit: "contain",
    width: 160,
    height: 160,
    backgroundColor: "transparent",
    display: "block",
  },

  /**
   * Desmancha o balão em volta da figurinha.
   *
   * As classes messageLeft e messageRight pintam fundo, sombra e largura
   * mínima -- tudo certo para texto e errado para figurinha, que no WhatsApp
   * flutua sobre o papel de parede. O minWidth de 100px era o que deixava
   * aquela faixa vazia ao lado do desenho.
   */
  balaoFigurinha: {
    backgroundColor: "transparent !important",
    boxShadow: "none !important",
    minWidth: "0 !important",
    padding: 0,
    "&::before": { display: "none" },
  },

  // Sem o nome do arquivo, sobra só a hora -- que no balão comum fica solta no
  // canto e aqui precisa de um espaço próprio, embaixo do desenho.
  rodapeFigurinha: {
    padding: "0 6px 4px",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
  },

  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 8,
    color: theme.palette.unmess.textoApagado,
  },

  // Separador de dia: é uma legenda, não um aviso. Vinha num azul-claro fixo
  // que virava uma mancha clara no modo escuro e ainda insinuava um estado
  // ("informação"?) que o separador não tem.
  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    backgroundColor: theme.palette.unmess.superficie,
    margin: "10px",
    borderRadius: 999,
    fontSize: "0.8125rem",
    fontWeight: 600,
  },

  dailyTimestampText: {
    color: theme.palette.unmess.textoApagado,
    padding: "4px 12px",
    display: "block",
    alignSelf: "center",
    marginLeft: "0px",
  },

  internalNoteWrapper: {
    display: "flex",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 8,
  },

  internalNote: {
    backgroundColor: theme.palette.unmess.atencaoSuave,
    border: `1px dashed ${theme.palette.unmess.atencao}`,
    color: theme.palette.unmess.texto,
    borderRadius: 12,
    padding: "8px 12px",
    maxWidth: "70%",
    fontSize: "0.9em",
    whiteSpace: "pre-wrap",
    boxShadow: "none",
  },

  internalNoteLabel: {
    display: "block",
    fontWeight: 600,
    fontSize: "0.78rem",
    color: theme.palette.unmess.atencao,
    marginBottom: 2,
  },

  // Discreto de propósito: fica junto do horário, só para o atendente saber
  // que a resposta saiu do celular e não do painel.
  fromAppLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    marginRight: 4,
    fontSize: "0.7rem",
    opacity: 0.75,
  },

  fromAppIcon: {
    fontSize: "0.85rem",
  },

  contadorBusca: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
  },

  abrirBusca: {
    marginLeft: "auto",
  },

  // Sem fundo nem borda enquanto está fechada: não há barra, só um botão.
  searchBarFechada: {
    borderBottom: "none",
    backgroundColor: "transparent",
    padding: "0 4px",
  },

  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 12px",
    borderBottom: `1px solid ${theme.palette.unmess.linha}`,
    backgroundColor: theme.palette.unmess.superficie,
  },

  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: theme.palette.unmess.primaria,
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
  },

  ackErroIcon: {
    color: theme.palette.error.main,
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  // Balão de uma mensagem que ainda está saindo. O leve apagamento é o que
  // separa, à primeira vista, o que já é história do que ainda depende da
  // rede.
  balaoEnviando: {
    opacity: 0.72,
  },

  barraFalha: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingTop: 4,
    borderTop: `1px solid ${theme.palette.divider}`,
    fontSize: "0.72rem",
    color: theme.palette.error.main,
  },

  botaoTentarNovamente: {
    fontSize: "0.72rem",
    minWidth: 0,
    padding: "0 6px",
  },

  previaEnvio: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap",
    marginBottom: 4,
  },

  miniaturaEnvio: {
    width: 120,
    maxWidth: "100%",
    borderRadius: 4,
    display: "block",
  },

  anexoEnvio: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: "0.75rem",
    opacity: 0.8,
  },

  // Citação clicável: o alvo é a mensagem original, esteja ela nesta conversa
  // ou em um atendimento já encerrado do mesmo contato.
  citacaoClicavel: {
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    border: "none",
    background: "transparent",
    // Sem "padding", de propósito: quem manda no espaçamento é quotedMsg, que
    // vem junto nesta mesma classe.
    font: "inherit",
    color: "inherit",
    "&:hover": { backgroundColor: "rgba(0,0,0,0.06)" },
  },

  marcaOutroTicket: {
    display: "inline-block",
    marginBottom: 2,
    padding: "0 6px",
    borderRadius: 10,
    fontSize: "0.65rem",
    fontWeight: 600,
    color: theme.palette.getContrastText(theme.palette.warning.light),
    backgroundColor: theme.palette.warning.light,
  },

  // Realce temporário de quem foi alcançado por uma citação: sem ele, a tela
  // rolava até a mensagem certa e o atendente não sabia qual das linhas era.
  mensagemDestacada: {
    animation: "$pulsoDestaque 2.2s ease-out",
  },

  "@keyframes pulsoDestaque": {
    "0%": { backgroundColor: theme.palette.warning.light },
    "70%": { backgroundColor: theme.palette.warning.light },
    "100%": { backgroundColor: "transparent" },
  },

  molduraPdf: {
    width: "100%",
    height: 380,
    border: "none",
    display: "block",
    backgroundColor: theme.palette.background.default,
  },

  visualizadorPdf: {
    width: "min(420px, 70vw)",
    borderRadius: 4,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
  },

  rodapePdf: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "4px 8px",
    fontSize: "0.75rem",
    backgroundColor: theme.palette.background.paper,
  },

  nomePdf: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload;
    const newMessages = [];

    messages.forEach((message) => {
      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...state];
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }

    return [...state];
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      state[messageIndex] = messageToUpdate;
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const MessagesList = ({ ticketId, isGroup }) => {
  const classes = useStyles();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastMessageRef = useRef();
  // Se a pessoa está acompanhando o fim da conversa. Em ref, e não em estado,
  // porque quem consulta é o handler do socket — registrado uma vez, ele
  // enxergaria para sempre o valor do primeiro render.
  const naFrenteRef = useRef(true);
  const [mostrarIrParaFim, setMostrarIrParaFim] = useState(false);
  const [novasAbaixo, setNovasAbaixo] = useState(0);

  // Mensagem realçada por ter sido alcançada a partir de uma citação.
  const [destacada, setDestacada] = useState(null);
  const fimRef = useRef();
  const hasMoreRef = useRef(false);
  const history = useHistory();
  const location = useLocation();
  const { pendentes, reenviar, descartar, enviar } = useOutgoingMessages();

  const [selectedMessage, setSelectedMessage] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const currentTicketId = useRef(ticketId);
  // Ref porque o handler do socket é registrado uma vez e não enxergaria
  // o valor atualizado do state.
  const searchOpenRef = useRef(false);

  useEffect(() => {
    searchOpenRef.current = Boolean(debouncedSearch);
  }, [debouncedSearch]);

  // Em ref porque quem consulta é a busca pela mensagem citada, que roda em
  // laço fora do ciclo de render e enxergaria sempre o valor de partida.
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);

    currentTicketId.current = ticketId;
    naFrenteRef.current = true;
    setMostrarIrParaFim(false);
    setNovasAbaixo(0);
  }, [ticketId]);

  // Trocar de conversa fecha a busca — o termo anterior não faz sentido aqui.
  useEffect(() => {
    setSearchOpen(false);
    setSearchTerm("");
    setDebouncedSearch("");
  }, [ticketId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        try {
          const { data } = await api.get("/messages/" + ticketId, {
            params: {
              pageNumber,
              ...(debouncedSearch ? { searchParam: debouncedSearch } : {}),
            },
          });

          if (currentTicketId.current === ticketId) {
            dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
            setHasMore(data.hasMore);
            setLoading(false);
          }

          if (pageNumber === 1 && data.messages.length > 1 && !debouncedSearch) {
            scrollToBottom();
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchMessages();
    }, 500);
    return () => {
      clearTimeout(delayDebounceFn);
    };
  }, [pageNumber, ticketId, debouncedSearch]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("connect", () => socket.emit("joinChatBox", ticketId));

    socket.on("appMessage", (data) => {
      // O backend emite appMessage para a sala da empresa inteira, então
      // chegam aqui mensagens de todas as conversas. Sem esse filtro, o chat
      // aberto ia recebendo mensagens que pertencem a outros tickets.
      // ticketId vem da rota como string; message.ticketId é inteiro.
      if (data.message?.ticketId !== Number(ticketId)) return;

      if (data.action === "create") {
        // Durante uma busca a lista mostra um recorte do histórico; empurrar
        // mensagem nova ali confundiria o resultado.
        if (searchOpenRef.current) return;
        dispatch({ type: "ADD_MESSAGE", payload: data.message });

        if (naFrenteRef.current) {
          scrollToBottom();
        } else {
          // Longe do fim: em vez de arrastar a tela, avisa que chegou algo e
          // deixa a pessoa decidir quando descer.
          setNovasAbaixo((n) => n + 1);
          setMostrarIrParaFim(true);
        }
      }

      if (data.action === "update") {
        dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId]);

  const loadMore = useCallback(() => {
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  }, []);

  const idsNaLista = useMemo(
    () => new Set(messagesList.map((m) => m.id)),
    [messagesList]
  );

  /**
   * Mensagens desta conversa que ainda estão saindo — ou que falharam.
   *
   * A que já foi confirmada some daqui assim que a versão real chega pelo
   * socket. Enquanto não chega, a otimista continua na tela: sem isso o balão
   * piscava, desaparecendo entre a resposta do servidor e o eco do WhatsApp.
   */
  const pendentesDaConversa = useMemo(
    () =>
      pendentes.filter((item) => {
        if (item.ticketId !== String(ticketId)) return false;
        if (searchOpenRef.current) return false;
        if (item.status !== "enviada") return true;

        return !(
          item.idsReais.length > 0 &&
          item.idsReais.every((id) => idsNaLista.has(id))
        );
      }),
    [pendentes, ticketId, idsNaLista]
  );

  // Enviar leva a conversa para o fim: a mensagem que acabou de sair é o que
  // o atendente quer ver, mesmo que estivesse lendo o histórico.
  const quantasPendentes = pendentesDaConversa.length;
  const pendentesAnteriores = useRef(0);
  useEffect(() => {
    if (quantasPendentes > pendentesAnteriores.current) {
      scrollToBottom();
    }
    pendentesAnteriores.current = quantasPendentes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantasPendentes]);

  const scrollToBottom = (suave = false) => {
    // A âncora fica depois de tudo, inclusive das mensagens que ainda estão
    // saindo. Usar a última mensagem carregada parava a rolagem um balão
    // antes do fim quando havia algo na fila de envio.
    const alvo = fimRef.current || lastMessageRef.current;

    if (alvo) {
      alvo.scrollIntoView(
        suave ? { behavior: "smooth", block: "end" } : { block: "end" }
      );
    }
    naFrenteRef.current = true;
    setNovasAbaixo(0);
  };

  /**
   * Leva a conversa até uma mensagem específica e a realça.
   *
   * Se ela ainda não foi carregada, vai buscando páginas mais antigas até
   * encontrá-la. O limite existe para uma citação a uma mensagem de meses
   * atrás não virar uma varredura sem fim do histórico.
   */
  const focarMensagem = useCallback(
    async (messageId) => {
      for (let tentativa = 0; tentativa < 12; tentativa += 1) {
        const elemento = document.getElementById(`mensagem-${messageId}`);

        if (elemento) {
          elemento.scrollIntoView({ behavior: "smooth", block: "center" });
          setDestacada(messageId);
          setTimeout(() => setDestacada(null), 2500);
          return true;
        }

        if (!hasMoreRef.current) break;

        loadMore();
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 900));
      }

      toast.info(i18n.t("messagesList.quotedNotLoaded"));
      return false;
    },
    [loadMore]
  );

  /**
   * Clique na citação.
   *
   * Quando a mensagem citada pertence a outro atendimento — o contato
   * respondeu algo de uma conversa já encerrada — abre aquele ticket e rola
   * até lá. A conversa atual só muda neste clique: antes daqui, a citação era
   * um texto morto e o atendente não tinha como chegar ao original.
   */
  const irParaCitada = useCallback(
    (citada) => {
      if (!citada?.id) return;

      const outroTicket =
        citada.ticketId && Number(citada.ticketId) !== Number(ticketId);

      if (outroTicket) {
        history.push(`/tickets/${citada.ticketId}`, {
          mensagemAlvo: citada.id,
        });
        return;
      }

      focarMensagem(citada.id);
    },
    [focarMensagem, history, ticketId]
  );

  // Chegou por uma citação de outro atendimento: assim que a conversa carrega,
  // procura a mensagem que motivou a vinda.
  const alvoDaRota = location.state?.mensagemAlvo;
  useEffect(() => {
    if (!alvoDaRota || loading || messagesList.length === 0) return;

    focarMensagem(alvoDaRota);
    // Limpa o estado da rota para o realce não se repetir a cada recarga.
    history.replace(location.pathname, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvoDaRota, loading, messagesList.length]);

  // Margem generosa: quem está a cem pixels do fim ainda está "acompanhando",
  // e para essa pessoa a rolagem automática ajuda em vez de atrapalhar.
  const MARGEM_FIM = 120;

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    const noFim = scrollHeight - (scrollTop + clientHeight) < MARGEM_FIM;
    naFrenteRef.current = noFim;
    if (noFim && novasAbaixo > 0) setNovasAbaixo(0);
    setMostrarIrParaFim(!noFim);

    if (!hasMore) return;

    if (scrollTop === 0) {
      document.getElementById("messagesList").scrollTop = 1;
    }

    if (loading) {
      return;
    }

    if (scrollTop < 50) {
      loadMore();
    }
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  /**
   * O nome do arquivo entra na condição junto com o mediaType porque as
   * mensagens gravadas antes da correção no backend ficaram como "image";
   * sem isso, o histórico continuaria aparecendo dentro de balão.
   */
  const ehFigurinha = (message) =>
    message.mediaType === "sticker" ||
    /(^|\/)sticker-/i.test(message.mediaUrl || "");

  const ehAudio = (message) =>
    message.mediaType === "audio" || message.mediaType === "ptt";

  /**
   * Se o corpo da mensagem deve aparecer embaixo do anexo.
   *
   * Numa mensagem de voz o corpo é o nome do arquivo — um carimbo de tempo
   * como "1756938287793.ogg" —, que não diz nada embaixo do player. O
   * backend parou de gravá-lo, e esta checagem cobre também o que já está no
   * histórico. A exceção é a mensagem apagada: aí o corpo é o aviso de que
   * ela foi apagada, e é a única coisa que resta para ler.
   */
  const mostrarCorpo = (message) => !ehAudio(message) || message.isDeleted;

  const checkMessageMedia = (message) => {
    if (message.mediaType === "location" && message.body.split('|').length >= 2) {
      let locationParts = message.body.split('|')
      let imageLocation = locationParts[0]
      let linkLocation = locationParts[1]

      let descriptionLocation = null

      if (locationParts.length > 2)
        descriptionLocation = message.body.split('|')[2]

      return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />
    }
    else if (message.mediaType === "vcard") {
      //console.log("vcard")
      //console.log(message)
      let array = message.body.split("\n");
      let obj = [];
      let contact = "";
      for (let index = 0; index < array.length; index++) {
        const v = array[index];
        let values = v.split(":");
        for (let ind = 0; ind < values.length; ind++) {
          if (values[ind].indexOf("+") !== -1) {
            obj.push({ number: values[ind] });
          }
          if (values[ind].indexOf("FN") !== -1) {
            contact = values[ind + 1];
          }
        }
      }
      return <VcardPreview contact={contact} numbers={obj[0]?.number} />
    }
    else if (message.mediaType === "multi_vcard") {
      // Reativado: antes ficava comentado e a mensagem caía no branch de
      // download, virando um botão quebrado. Se o corpo não for um JSON
      // válido, mostra o texto cru em vez de derrubar a lista inteira.
      if (!message.body) return null;

      try {
        const contacts = JSON.parse(message.body);
        if (!Array.isArray(contacts)) return <>{message.body}</>;

        return (
          <>
            {contacts.map((v, i) => (
              <VcardPreview
                key={`${v.number ?? i}`}
                contact={v.name}
                numbers={v.number}
              />
            ))}
          </>
        );
      } catch {
        return <>{message.body}</>;
      }
    }
    // Figurinha vem antes da imagem: chega como .webp e caía no botão
    // "Download", com o atendente vendo um anexo genérico no lugar do desenho.
    //
    // O nome do arquivo entra na condição junto com o mediaType porque as
    // mensagens gravadas antes da correção no backend ficaram com "image"; sem
    // isso, todo o histórico continuaria aparecendo errado.
    else if (
      message.mediaType === "sticker" ||
      /(^|\/)sticker-/i.test(message.mediaUrl || "")
    ) {
      return (
        <img
          className={classes.messageSticker}
          src={mediaUrl(message.mediaUrl)}
          alt="Figurinha"
        />
      );
    }
    // webp entrou na lista: é formato comum de imagem hoje, e sem ele uma foto
    // enviada nesse formato virava botão de download como as figurinhas.
    else if ( /^.*\.(jpe?g|png|gif|webp)?$/i.exec(message.mediaUrl) && message.mediaType === "image") {
      return <ModalImageCors imageUrl={mediaUrl(message.mediaUrl)} />;
    } else if (message.mediaType === "audio") {
      return <Audio url={mediaUrl(message.mediaUrl)} />
    } else if (message.mediaType === "video") {
      return (
        <video
          className={classes.messageMedia}
          src={mediaUrl(message.mediaUrl)}
          controls
        />
      );
    }
    // PDF abre na própria conversa. Antes virava um botão "Download": para
    // conferir um orçamento ou um comprovante o atendente precisava baixar o
    // arquivo, sair do navegador e voltar.
    else if (/\.pdf(\?|$)/i.test(message.mediaUrl || "")) {
      const endereco = mediaUrl(message.mediaUrl);
      const nome = message.body || "PDF";

      return (
        <div className={classes.visualizadorPdf}>
          <object
            data={endereco}
            type="application/pdf"
            className={classes.molduraPdf}
            aria-label={nome}
          >
            {/* Navegador sem leitor embutido — celular, na maior parte das
                vezes: em vez da moldura vazia, o caminho para abrir. */}
            <div className={classes.downloadMedia}>
              <Button
                startIcon={<GetApp />}
                color="primary"
                variant="outlined"
                target="_blank"
                rel="noopener noreferrer"
                href={endereco}
              >
                {i18n.t("messagesList.openPdf")}
              </Button>
            </div>
          </object>
          <div className={classes.rodapePdf}>
            <span className={classes.nomePdf} title={nome}>
              {nome}
            </span>
            <Button
              size="small"
              color="primary"
              target="_blank"
              rel="noopener noreferrer"
              href={endereco}
            >
              {i18n.t("messagesList.openPdf")}
            </Button>
          </div>
        </div>
      );
    } else {
      return (
        <>
          <div className={classes.downloadMedia}>
            <Button
              startIcon={<GetApp />}
              color="primary"
              variant="outlined"
              target="_blank"
              href={mediaUrl(message.mediaUrl)}
            >
              Download
            </Button>
          </div>
          <Divider />
        </>
      );
    }
  };

  const renderMessageAck = (message) => {
    // Falha de envio: o WhatsApp recusou a mensagem. Marcada em vermelho
    // porque, sem isso, ela ficava indistinguível de uma mensagem entregue —
    // era o caso do "aparece como enviada mas não chega ao contato".
    if (message.ack === -1) {
      return (
        <Tooltip title={i18n.t("messagesList.ack.failed")} arrow>
          <ErrorOutlineIcon
            fontSize="small"
            className={classes.ackErroIcon}
          />
        </Tooltip>
      );
    }
    if (message.ack === 0) {
      return (
        <Tooltip title={i18n.t("messagesList.ack.sending")} arrow>
          <AccessTime fontSize="small" className={classes.ackIcons} />
        </Tooltip>
      );
    }
    if (message.ack === 1) {
      return (
        <Tooltip title={i18n.t("messagesList.ack.sent")} arrow>
          <Done fontSize="small" className={classes.ackIcons} />
        </Tooltip>
      );
    }
    if (message.ack === 2) {
      return (
        <Tooltip title={i18n.t("messagesList.ack.delivered")} arrow>
          <DoneAll fontSize="small" className={classes.ackIcons} />
        </Tooltip>
      );
    }
    if (message.ack === 3 || message.ack === 4) {
      return (
        <Tooltip
          title={i18n.t(
            message.ack === 4
              ? "messagesList.ack.played"
              : "messagesList.ack.read"
          )}
          arrow
        >
          <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />
        </Tooltip>
      );
    }
  };

  /**
   * Aviso de falha, com a opção de mandar de novo.
   *
   * Vale para a mensagem que já está gravada e foi recusada pelo WhatsApp. O
   * reenvio passa pela mesma fila de sempre, com chave nova: a anterior falhou
   * de verdade, então não há risco de o contato receber duas vezes.
   */
  const renderFalhaMensagem = (message) => {
    if (message.ack !== -1) return null;

    return (
      <div className={classes.barraFalha}>
        <span>{i18n.t("messagesList.ack.failed")}</span>
        <Button
          size="small"
          color="inherit"
          className={classes.botaoTentarNovamente}
          startIcon={<RefreshIcon fontSize="inherit" />}
          onClick={() =>
            enviar({
              ticketId,
              body: message.body,
              quotedMsg: message.quotedMsg || null,
            })
          }
        >
          {i18n.t("messagesList.retry")}
        </Button>
      </div>
    );
  };

  const renderDailyTimestamps = (message, index) => {
    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {format(parseISO(messageDate(messagesList[index])), "dd/MM/yyyy")}
          </div>
        </span>
      );
    }
    if (index < messagesList.length - 1) {
      let messageDay = parseISO(messageDate(messagesList[index]));
      let previousMessageDay = parseISO(messageDate(messagesList[index - 1]));

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {format(parseISO(messageDate(messagesList[index])), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }
    }
    if (index === messagesList.length - 1) {
      return (
        <div
          key={`ref-${messageDate(message)}`}
          ref={lastMessageRef}
          style={{ float: "left", clear: "both" }}
        />
      );
    }
  };

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;

      if (messageUser !== previousMessageUser) {
        return (
          <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
        );
      }
    }
  };

  const renderQuotedMessage = (message) => {
    const citada = message.quotedMsg;
    // A citada pode ser de outro atendimento do mesmo contato: o cliente
    // respondeu a algo dito antes de a conversa anterior ser encerrada. A
    // prévia aparece igual, mas marcada — e o clique leva ao ticket certo em
    // vez de trocar a conversa por baixo do atendente.
    const deOutroTicket =
      citada?.ticketId && Number(citada.ticketId) !== Number(ticketId);

    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: citada?.fromMe,
          })}
        ></span>
        <button
          type="button"
          className={clsx(classes.quotedMsg, classes.citacaoClicavel)}
          onClick={() => irParaCitada(citada)}
          title={i18n.t(
            deOutroTicket
              ? "messagesList.quotedOtherTicketTooltip"
              : "messagesList.quotedGoTo"
          )}
        >
          {deOutroTicket && (
            <span className={classes.marcaOutroTicket}>
              {i18n.t("messagesList.quotedOtherTicket")}
            </span>
          )}
          {!citada?.fromMe && (
            <span className={classes.messageContactName}>
              {citada?.contact?.name}
            </span>
          )}
          {citada?.body}
        </button>
      </div>
    );
  };

  /**
   * Balões das mensagens que ainda estão saindo.
   *
   * Ficam depois das já gravadas, sempre no fim da conversa, e desaparecem
   * quando a versão real chega pelo socket.
   */
  const renderPendentes = () =>
    pendentesDaConversa.map((item) => (
      <div
        key={item.id}
        className={clsx(classes.messageRight, {
          [classes.balaoEnviando]: item.status !== "falha",
        })}
      >
        <div className={classes.textContentItem}>
          {item.previas?.length > 0 && (
            <div className={classes.previaEnvio}>
              {item.previas.map((previa, indice) =>
                previa.url ? (
                  <img
                    key={`${item.id}-${indice}`}
                    src={previa.url}
                    alt={previa.nome}
                    className={classes.miniaturaEnvio}
                  />
                ) : (
                  <span
                    key={`${item.id}-${indice}`}
                    className={classes.anexoEnvio}
                  >
                    <InsertDriveFileIcon fontSize="small" />
                    {previa.nome}
                  </span>
                )
              )}
            </div>
          )}

          <MarkdownWrapper>{item.body}</MarkdownWrapper>

          <span className={classes.timestamp}>
            {format(parseISO(item.criadoEm), "HH:mm")}
            {item.status === "falha" ? (
              <ErrorOutlineIcon
                fontSize="small"
                className={classes.ackErroIcon}
              />
            ) : (
              <ScheduleIcon fontSize="small" className={classes.ackIcons} />
            )}
          </span>

          {item.status === "falha" && (
            <div className={classes.barraFalha}>
              <span>{i18n.t("messagesList.sendFailed")}</span>
              <Button
                size="small"
                color="inherit"
                className={classes.botaoTentarNovamente}
                startIcon={<RefreshIcon fontSize="inherit" />}
                onClick={() => reenviar(item.id)}
              >
                {i18n.t("messagesList.retry")}
              </Button>
              <Button
                size="small"
                color="inherit"
                className={classes.botaoTentarNovamente}
                onClick={() => descartar(item.id)}
              >
                {i18n.t("messagesList.discard")}
              </Button>
            </div>
          )}
        </div>
      </div>
    ));

  const renderMessages = () => {
    if (messagesList.length > 0) {
      const viewMessagesList = messagesList.map((message, index) => {
        // Nota interna: visual distinto (amarelo, sem ack) para o atendente
        // nunca confundir com algo que o cliente recebeu.
        if (message.isInternal) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              <div
                id={`mensagem-${message.id}`}
                className={clsx(classes.internalNoteWrapper, {
                  [classes.mensagemDestacada]: destacada === message.id,
                })}
              >
                <div className={classes.internalNote}>
                  <span className={classes.internalNoteLabel}>
                    {i18n.t("messagesList.internalNote")}
                    {message.user?.name ? ` · ${message.user.name}` : ""}
                  </span>
                  <MarkdownWrapper>{message.body}</MarkdownWrapper>
                  <span className={classes.timestamp}>
                    {format(parseISO(messageDate(message)), "HH:mm")}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        }

        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              <div
                id={`mensagem-${message.id}`}
                className={clsx(classes.messageLeft, {
                  [classes.balaoFigurinha]: ehFigurinha(message),
                  [classes.mensagemDestacada]: destacada === message.id,
                })}
              >
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>
                )}
                {(message.mediaUrl ||
                  message.mediaType === "location" ||
                  message.mediaType === "vcard" ||
                  message.mediaType === "multi_vcard") &&
                  checkMessageMedia(message)}
                {ehFigurinha(message) ? (
                  // O corpo da mensagem guarda o nome do arquivo, que numa
                  // figurinha não diz nada a ninguém -- fica só o horário.
                  <div className={classes.rodapeFigurinha}>
                    <span className={classes.timestamp}>
                      {format(parseISO(messageDate(message)), "HH:mm")}
                    </span>
                  </div>
                ) : (
                  <div className={classes.textContentItem}>
                    {message.quotedMsg && renderQuotedMessage(message)}
                    {mostrarCorpo(message) && (
                      <MarkdownWrapper>{message.body}</MarkdownWrapper>
                    )}
                    <span className={classes.timestamp}>
                      {format(parseISO(messageDate(message)), "HH:mm")}
                    </span>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              <div
                id={`mensagem-${message.id}`}
                className={clsx(classes.messageRight, {
                  // Mensagem apagada mantém o balão: o "esta mensagem foi
                  // apagada" é texto e precisa do fundo para ser legível.
                  [classes.balaoFigurinha]:
                    ehFigurinha(message) && !message.isDeleted,
                  [classes.mensagemDestacada]: destacada === message.id,
                })}
              >
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {(message.mediaUrl ||
                  message.mediaType === "location" ||
                  message.mediaType === "vcard" ||
                  message.mediaType === "multi_vcard") &&
                  checkMessageMedia(message)}
                {ehFigurinha(message) && !message.isDeleted ? (
                  <div className={classes.rodapeFigurinha}>
                    <span className={classes.timestamp}>
                      {format(parseISO(messageDate(message)), "HH:mm")}
                      {renderMessageAck(message)}
                    </span>
                  </div>
                ) : (
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                  })}
                >
                  {message.isDeleted && (
                    <Block
                      color="disabled"
                      fontSize="small"
                      className={classes.deletedIcon}
                    />
                  )}
                  {message.quotedMsg && renderQuotedMessage(message)}
                  {mostrarCorpo(message) && (
                    <MarkdownWrapper>{message.body}</MarkdownWrapper>
                  )}
                  <span className={classes.timestamp}>
                    {message.fromApp && (
                      <span
                        className={classes.fromAppLabel}
                        title={i18n.t("messagesList.fromAppTooltip")}
                      >
                        <PhoneAndroid className={classes.fromAppIcon} />
                        {i18n.t("messagesList.fromApp")}
                      </span>
                    )}
                    {message.isEdited && (
                      <span className={classes.fromAppLabel}>
                        {i18n.t("messagesList.edited")}
                      </span>
                    )}
                    {format(parseISO(messageDate(message)), "HH:mm")}
                    {renderMessageAck(message)}
                  </span>
                  {renderFalhaMensagem(message)}
                </div>
                )}
              </div>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
      // Conversa nova com a primeira mensagem ainda saindo: o balão dela já
      // está na tela, e o "nenhuma mensagem" ao lado seria contraditório.
      if (quantasPendentes > 0) return null;

      return (
        <EmptyState
          icon={ChatBubbleOutlineIcon}
          title={i18n.t("messagesList.empty.title")}
          description={i18n.t("messagesList.empty.message")}
        />
      );
    }
  };

  return (
    <div className={classes.messagesListWrapper}>
      <div className={clsx(classes.searchBar, !searchOpen && classes.searchBarFechada)}>
        {searchOpen ? (
          <>
            <SearchIcon fontSize="small" />
            <InputBase
              autoFocus
              fullWidth
              placeholder={i18n.t("messagesList.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Tooltip title={i18n.t("messagesList.closeSearch")} arrow>
              <IconButton
                size="small"
                aria-label={i18n.t("messagesList.closeSearch")}
                onClick={() => {
                  setSearchOpen(false);
                  setSearchTerm("");
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <Tooltip title={i18n.t("messagesList.searchPlaceholder")} arrow>
            <IconButton
              size="small"
              className={classes.abrirBusca}
              aria-label={i18n.t("messagesList.searchPlaceholder")}
              onClick={() => setSearchOpen(true)}
            >
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {debouncedSearch && (
          <span style={{ fontSize: "0.8125rem", whiteSpace: "nowrap", opacity: 0.75 }}>
            {i18n.t("messagesList.searchResults", {
              count: messagesList.length,
            })}
          </span>
        )}
      </div>
      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
      />
      <div
        id="messagesList"
        className={classes.messagesList}
        onScroll={handleScroll}
      >
        {renderMessages()}
        {renderPendentes()}
        {/* Âncora do fim: fica depois de tudo, inclusive do que ainda está
            saindo, para a rolagem automática parar no lugar certo. */}
        <div ref={fimRef} style={{ float: "left", clear: "both" }} />
      </div>
      {mostrarIrParaFim && (
        <Button
          size="small"
          variant="contained"
          color={novasAbaixo > 0 ? "primary" : "inherit"}
          className={classes.irParaFim}
          startIcon={<ArrowDownwardIcon fontSize="small" />}
          onClick={() => scrollToBottom(true)}
        >
          {novasAbaixo > 0
            ? i18n.t("messagesList.newMessages", { count: novasAbaixo })
            : i18n.t("messagesList.goToEnd")}
        </Button>
      )}

      {loading && (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      )}
    </div>
  );
};

export default MessagesList;