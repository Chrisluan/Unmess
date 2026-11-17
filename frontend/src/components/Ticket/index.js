import React, { useState, useEffect, useContext } from "react";
import { useParams, useHistory } from "react-router-dom";

import { toast } from "react-toastify";
import openSocket from "../../services/socket-io";
import makeStyles from '@mui/styles/makeStyles';

import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInput/";
import TicketHeader from "../TicketHeader";
import TicketInfo, { ChipNegocio } from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtons";
import MessagesList from "../MessagesList";
import PendingTicketBar from "../PendingTicketBar";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

const CHAVE_PAINEL = "painelClienteAberto";

const lerPainel = () => {
  try {
    const salvo = localStorage.getItem(CHAVE_PAINEL);
    if (salvo !== null) return salvo === "true";
  } catch {
    return window.innerWidth >= 1440;
  }
  return window.innerWidth >= 1440;
};

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  mainWrapper: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: theme.palette.unmess.fundoConversa,
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [drawerOpen, setDrawerOpen] = useState(lerPainel);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});

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
        toast.success("Ticket deleted sucessfully.");
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

    return () => {
      socket.disconnect();
    };
  }, [ticketId, history]);

  const mudarPainel = (aberto) => {
    setDrawerOpen(aberto);
    try {
      localStorage.setItem(CHAVE_PAINEL, String(aberto));
    } catch {
      return;
    }
  };

  const handleDrawerClose = () => mudarPainel(false);

  return (
    <div className={classes.root} id="drawer-container">
      <div className={classes.mainWrapper}>
        <TicketHeader loading={loading}>
          <TicketInfo contact={contact} ticket={ticket} onClick={() => mudarPainel(!drawerOpen)} />
          <TicketActionButtons
            ticket={ticket}
            painelAberto={drawerOpen}
            onTogglePainel={() => mudarPainel(!drawerOpen)}
          >
            {ticket?.id && <ChipNegocio ticketId={ticket.id} onClick={() => mudarPainel(true)} />}
          </TicketActionButtons>
        </TicketHeader>
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
      </div>
      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        ticket={ticket}
        loading={loading}
      />
    </div>
  );
};

export default Ticket;
