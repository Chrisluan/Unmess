import React, { useState, useEffect, useReducer, useRef } from "react";

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
    backgroundColor: theme.palette.background.default,
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "20px 20px 20px 20px",
    overflowY: "scroll",
    [theme.breakpoints.down('md')]: {
      paddingBottom: "90px",
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
    color: theme.palette.primary.main,
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
    // Recebida é superfície neutra com borda; a borda é o que a separa do
    // fundo agora que não há mais sombra nem textura para fazer isso.
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    alignSelf: "flex-start",
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 5,
    paddingBottom: 0,
  },

  quotedContainerLeft: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: theme.palette.action.hover,
    borderRadius: 0,
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
    width: "3px",
    backgroundColor: theme.palette.primary.main,
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
    // Enviada é bloco de cor cheia: de relance, o lado azul é o nosso e o lado
    // claro é o do cliente, sem precisar ler o alinhamento.
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    alignSelf: "flex-end",
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 5,
    paddingBottom: 0,
  },

  quotedContainerRight: {
    margin: "-3px -80px 6px -6px",
    overflowY: "hidden",
    // Um véu escuro sobre o azul do balão, e não uma cor fixa: escurece o
    // suficiente para destacar a citação nos dois modos, sem mexer na
    // opacidade do bloco -- que apagaria o texto citado junto.
    backgroundColor: "rgba(0,0,0,0.12)",
    borderRadius: 0,
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
    width: "3px",
    backgroundColor: "currentColor",
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "inherit",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  // Nome de quem falou dentro do grupo: precisa distinguir participantes sem
  // virar destaque, por isso peso e não cor forte.
  messageContactName: {
    display: "flex",
    color: theme.palette.primary.main,
    fontWeight: 700,
    fontSize: "0.78rem",
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  // Apagada continua legível, só apagada: o cinza fixo sumia por completo no
  // modo escuro e dentro do balão azul.
  textContentItemDeleted: {
    fontStyle: "italic",
    opacity: 0.6,
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
    right: 5,
    color: "currentColor",
    opacity: 0.7,
  },

  // Separador de dia: é uma legenda, não um aviso. Vinha num azul-claro fixo
  // que virava uma mancha clara no modo escuro e ainda insinuava um estado
  // ("informação"?) que o separador não tem.
  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "110px",
    backgroundColor: theme.palette.action.hover,
    border: `1px solid ${theme.palette.divider}`,
    margin: "10px",
    borderRadius: 0,
  },

  dailyTimestampText: {
    color: theme.palette.text.secondary,
    padding: 8,
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
    backgroundColor:
      theme.palette.mode === "dark" ? "rgba(224,163,58,0.16)" : "#fff8c4",
    border: `1px solid ${theme.palette.warning.main}`,
    color: theme.palette.mode === "dark" ? theme.palette.text.primary : "#5a4b00",
    borderRadius: 0,
    padding: "6px 10px",
    maxWidth: "70%",
    fontSize: "0.9em",
    whiteSpace: "pre-wrap",
    boxShadow: "0 1px 1px rgba(0,0,0,0.1)",
  },

  internalNoteLabel: {
    display: "block",
    fontWeight: 600,
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: 0.4,
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
    padding: "4px 8px",
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
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
    color: theme.palette.primary.main,
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

  const loadMore = () => {
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const scrollToBottom = (suave = false) => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView(
        suave ? { behavior: "smooth", block: "end" } : { block: "end" }
      );
    }
    naFrenteRef.current = true;
    setNovasAbaixo(0);
  };

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
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 2) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 3 || message.ack === 4) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
    }
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
    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {message.quotedMsg?.contact?.name}
            </span>
          )}
          {message.quotedMsg?.body}
        </div>
      </div>
    );
  };

  const renderMessages = () => {
    if (messagesList.length > 0) {
      const viewMessagesList = messagesList.map((message, index) => {
        // Nota interna: visual distinto (amarelo, sem ack) para o atendente
        // nunca confundir com algo que o cliente recebeu.
        if (message.isInternal) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              <div className={classes.internalNoteWrapper}>
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
                className={clsx(classes.messageLeft, {
                  [classes.balaoFigurinha]: ehFigurinha(message),
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
                    <MarkdownWrapper>{message.body}</MarkdownWrapper>
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
                className={clsx(classes.messageRight, {
                  // Mensagem apagada mantém o balão: o "esta mensagem foi
                  // apagada" é texto e precisa do fundo para ser legível.
                  [classes.balaoFigurinha]:
                    ehFigurinha(message) && !message.isDeleted,
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
                  <MarkdownWrapper>{message.body}</MarkdownWrapper>
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
                </div>
                )}
              </div>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
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
          <span className={classes.contadorBusca}>
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
        {messagesList.length > 0 ? renderMessages() : []}
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