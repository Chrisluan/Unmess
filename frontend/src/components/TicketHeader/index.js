import React from "react";

import { Card, IconButton, Tooltip, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { useTheme } from "@mui/material/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useHistory } from "react-router-dom";

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
    backgroundColor: theme.palette.background.paper,
    flex: "none",
    borderBottom: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down("md")]: {
      flexWrap: "wrap",
    },
  },

  voltar: {
    marginLeft: theme.spacing(0.5),
  },
}));

const TicketHeader = ({ loading, children }) => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  // No desktop a lista de conversas está ao lado, sempre visível: a seta de
  // voltar não leva a lugar nenhum que já não esteja na tela, e ocupava o
  // primeiro lugar do cabeçalho -- onde deveria estar o nome do cliente.
  const telaEstreita = useMediaQuery(theme.breakpoints.down("md"));

  const handleBack = () => {
    history.push("/tickets");
  };

  return (
    <>
      {loading ? (
        <TicketHeaderSkeleton />
      ) : (
        <Card square className={classes.ticketHeader}>
          {telaEstreita && (
            <Tooltip title="Voltar para a lista de conversas" arrow>
              <IconButton
                className={classes.voltar}
                onClick={handleBack}
                aria-label="Voltar para a lista de conversas"
                size="small"
              >
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
          )}
          {children}
        </Card>
      )}
    </>
  );
};

export default TicketHeader;
