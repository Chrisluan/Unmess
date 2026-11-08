import React, { useState, useEffect, useContext, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";

import { toast } from "react-toastify";
import openSocket from "../../services/socket-io";
import clsx from "clsx";

import { Badge, IconButton, Paper, Tooltip } from "@mui/material";
import ContactPageOutlinedIcon from "@mui/icons-material/ContactPageOutlined";

import makeStyles from '@mui/styles/makeStyles';

import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInput/";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtons";
import MessagesList from "../MessagesList";
import TicketTagsSelect from "../TicketTagsSelect";
import { Can } from "../Can";
import PendingTicketBar from "../PendingTicketBar";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  ticketInfo: {
    // Elástico: com status, setor, conexão e protocolo no subtítulo, travar em
    // metade da largura truncava o nome do cliente em telas médias.
    flex: 1,
    minWidth: 0,
    [theme.breakpoints.down('md')]: {
      maxWidth: "80%",
      flexBasis: "80%",
    },
  },
  botaoPainel: {
    alignSelf: "center",
    marginRight: theme.spacing(1),
  },

  ticketActionButtons: {
    flex: "none",
    display: "flex",
    alignItems: "center",
    [theme.breakpoints.down('md')]: {
      maxWidth: "100%",
      flexBasis: "100%",
      marginBottom: "5px",
    },
  },

  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  // Pedidos ligados a esta conversa. Quem busca é o painel lateral; aqui só
  // se guarda a contagem, para o cabeçalho poder mostrá-la.
  const [pedidos, setPedidos] = useState([]);
  // Timer do agrupamento de "marcar como lida" (ver o socket mais abaixo).
  const marcaLeituraRef = useRef(null);
  // Chegou mensagem com a aba escondida: marcar ao voltar, não agora.
  const leituraPendenteRef = useRef(false);

  const marcarComoLida = () => {
    api.post(`/tickets/${ticketId}/read`).catch(() => {
      // Falhar aqui só deixa o contador desatualizado até a próxima abertura
      // da conversa; não vale interromper o atendente com um erro.
    });
  };

  // A conversa muda: o que ficou pendente era da anterior.
  useEffect(() => {
    leituraPendenteRef.current = false;
  }, [ticketId]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          const { data } = await api.get("/tickets/" + ticketId);

          setContact(data.contact);
          setTicket(data);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, history]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("connect", () => socket.emit("joinChatBox", ticketId));

    socket.on("ticket", (data) => {
      if (data.action === "update") {
        setTicket(data.ticket);
      }

      if (data.action === "delete") {
        toast.success(i18n.t("tickets.toasts.deleted"));
        history.push("/tickets");
      }
    });

    socket.on("contact", (data) => {
      if (data.action === "update") {
        setContact((prevState) => {
          if (prevState.id === data.contact?.id) {
            return { ...prevState, ...data.contact };
          }
          return prevState;
        });
      }
    });

    /**
     * Conversa aberta na tela não acumula "não lidas".
     *
     * A leitura só era registrada ao carregar o histórico ou ao responder.
     * Agora que o contador realmente conta, a conversa que o atendente está
     * lendo passaria a exibir 1, 2, 3... na frente dele até que saísse e
     * voltasse. Só vale com a aba visível: mensagem que chega com o navegador
     * em segundo plano ninguém leu, e é justamente a que precisa do aviso.
     */
    socket.on("appMessage", (data) => {
      if (data.action !== "create") return;
      if (data.message?.ticketId !== Number(ticketId)) return;
      if (data.message?.fromMe) return;

      if (document.visibilityState !== "visible") {
        // Chegou com a aba em segundo plano: ninguém leu. Fica anotado para
        // ser resolvido quando a pessoa voltar.
        leituraPendenteRef.current = true;
        return;
      }

      // Agrupa rajadas: cliente que manda cinco mensagens seguidas geraria
      // cinco chamadas, e cada uma manda um "visto" para o WhatsApp.
      clearTimeout(marcaLeituraRef.current);
      marcaLeituraRef.current = setTimeout(marcarComoLida, 800);
    });

    return () => {
      clearTimeout(marcaLeituraRef.current);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, history]);

  // Voltou para a aba com a conversa aberta: o que chegou enquanto ela estava
  // escondida acabou de ser lido. Sem o registro do que ficou pendente, todo
  // clique de volta na aba viraria uma chamada — e um "visto" para o WhatsApp.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      if (!leituraPendenteRef.current) return;
      leituraPendenteRef.current = false;
      marcarComoLida();
    };

    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
      >
        <TicketHeader loading={loading}>
          <div className={classes.ticketInfo}>
            <TicketInfo
              contact={contact}
              ticket={ticket}
              onClick={handleDrawerOpen}
            />
          </div>
          <div className={classes.ticketActionButtons}>
            <TicketActionButtons ticket={ticket} />
            <Tooltip
              arrow
              title={
                pedidos.length > 0
                  ? i18n.t("ticketInfo.togglePanelWithDeals", {
                      count: pedidos.length,
                    })
                  : i18n.t("ticketInfo.togglePanel")
              }
            >
              <IconButton
                className={classes.botaoPainel}
                aria-label={i18n.t("ticketInfo.togglePanel")}
                aria-pressed={drawerOpen}
                color={drawerOpen ? "primary" : "default"}
                onClick={drawerOpen ? handleDrawerClose : handleDrawerOpen}
                size="small"
              >
                <Badge badgeContent={pedidos.length} color="primary">
                  <ContactPageOutlinedIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          </div>
        </TicketHeader>
        {!loading && ticket?.id && (
          <Can permission="tags:assign">
            <TicketTagsSelect
              ticket={ticket}
              disabled={ticket.status === "closed"}
            />
          </Can>
        )}
        <ReplyMessageProvider>
          <MessagesList
            ticketId={ticketId}
            isGroup={ticket.isGroup}
          ></MessagesList>
          {/* Conhecido responde direto, mesmo se o ticket ainda estiver
              pendente por ter nascido antes da marcação. */}
          {ticket.status === "pending" && !ticket.contact?.isKnown ? (
            <PendingTicketBar ticket={ticket} userId={user?.id} />
          ) : (
            <MessageInput
              ticketStatus={ticket.contact?.isKnown ? "open" : ticket.status}
            />
          )}
        </ReplyMessageProvider>
      </Paper>
      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        loading={loading}
        onDealsCarregados={setPedidos}
      />
    </div>
  );
};

export default Ticket;
