import React, { useState } from "react";
import { useHistory } from "react-router-dom";

import { Box, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  barra: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : theme.palette.grey[100]
  },
  icone: {
    color: theme.palette.text.secondary,
    fontSize: 20
  },
  texto: {
    flex: 1,
    color: theme.palette.text.secondary
  }
}));

/**
 * Ocupa o lugar do campo de mensagem enquanto o atendimento não foi aceito.
 *
 * A conversa pendente agora abre para leitura, e sem este aviso o atendente
 * veria apenas um campo desabilitado, sem entender o motivo nem como liberar.
 */
const PendingTicketBar = ({ ticket, userId }) => {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await api.put(`/tickets/${ticket.id}`, { status: "open", userId });
      history.push(`/tickets/${ticket.id}`);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className={classes.barra}>
      <LockOutlinedIcon className={classes.icone} />
      <Typography variant="body2" className={classes.texto}>
        {i18n.t("ticketsList.pendingBar.readOnly")}
      </Typography>
      <ButtonWithSpinner
        loading={loading}
        size="small"
        variant="contained"
        color="primary"
        onClick={handleAccept}
      >
        {i18n.t("ticketsList.pendingBar.accept")}
      </ButtonWithSpinner>
    </Box>
  );
};

export default PendingTicketBar;
