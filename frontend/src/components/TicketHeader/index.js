import React from "react";

import { IconButton } from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useHistory } from "react-router-dom";

import TicketHeaderSkeleton from "../TicketHeaderSkeleton";

const useStyles = makeStyles((theme) => ({
  /**
   * Cabeçalho da conversa.
   *
   * Usava `#eee` e uma borda preta translúcida fixos: no modo escuro a faixa
   * ficava cinza-clara no meio de uma tela quase preta, e era a primeira
   * coisa que se via ao abrir um atendimento. Agora vem do tema, como o
   * resto das superfícies.
   */
  ticketHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    minHeight: 72,
    padding: theme.spacing(1, 2, 1, 2.5),
    flex: "none",
    backgroundColor: theme.palette.unmess.superficie,
    borderBottom: `1px solid ${theme.palette.unmess.linha}`,
    [theme.breakpoints.down("md")]: {
      padding: theme.spacing(1, 1.5, 1, 1),
    },
  },
  voltar: {
    display: "none",
    [theme.breakpoints.down("md")]: { display: "inline-flex" },
  },
}));

const TicketHeader = ({ loading, children }) => {
  const classes = useStyles();
  const history = useHistory();

  if (loading) return <TicketHeaderSkeleton />;

  return (
    <header className={classes.ticketHeader}>
      <IconButton className={classes.voltar} onClick={() => history.push("/tickets")} aria-label="Voltar para a lista">
        <ArrowBackIcon />
      </IconButton>
      {children}
    </header>
  );
};

export default TicketHeader;
