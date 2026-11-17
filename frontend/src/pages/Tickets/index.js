import React from "react";
import { useParams } from "react-router-dom";
import makeStyles from "@mui/styles/makeStyles";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";

import TicketsManager from "../../components/TicketsManager/";
import Ticket from "../../components/Ticket/";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;
  return {
    root: {
      flex: 1,
      minHeight: 0,
      height: "100%",
      display: "grid",
      gridTemplateColumns: "380px minmax(0, 1fr)",
      overflow: "hidden",
      [theme.breakpoints.down("lg")]: {
        gridTemplateColumns: "340px minmax(0, 1fr)",
      },
      [theme.breakpoints.down("md")]: {
        gridTemplateColumns: "minmax(0, 1fr)",
      },
    },
    lista: {
      minHeight: 0,
      borderRight: `1px solid ${c.linha}`,
      display: "flex",
      flexDirection: "column",
    },
    listaComConversa: {
      [theme.breakpoints.down("md")]: { display: "none" },
    },
    conversa: {
      minWidth: 0,
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      backgroundColor: c.fundoConversa,
    },
    conversaVazia: {
      [theme.breakpoints.down("md")]: { display: "none" },
    },
    vazio: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      color: c.textoApagado,
      textAlign: "center",
      padding: 24,
      "& svg": { fontSize: 48, color: c.linhaForte },
    },
  };
});

const Chat = () => {
  const classes = useStyles();
  const { ticketId } = useParams();

  return (
    <div className={classes.root}>
      <div className={`${classes.lista} ${ticketId ? classes.listaComConversa : ""}`}>
        <TicketsManager />
      </div>
      <div className={`${classes.conversa} ${ticketId ? "" : classes.conversaVazia}`}>
        {ticketId ? (
          <Ticket />
        ) : (
          <div className={classes.vazio}>
            <ChatBubbleOutlineIcon />
            <span>{i18n.t("chat.noTicketMessage")}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
