import React from "react";
import { useHistory } from "react-router-dom";

import makeStyles from "@mui/styles/makeStyles";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

const useStyles = makeStyles((theme) => ({
  conversa: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    marginBottom: 8,
  },

  icone: { color: "#25d366" },
  nome: { fontSize: 13.5, fontWeight: 600 },
  detalhe: { fontSize: 11.5, color: theme.palette.text.secondary },
  ultima: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 380,
  },
  vazio: { padding: "28px 0", textAlign: "center" },
}));

/**
 * Conversas de WhatsApp ligadas a este orçamento.
 *
 * Só lista e leva até lá: responder acontece na tela de atendimento, que tem o
 * histórico completo, os anexos e o compositor. Duplicar isso aqui significaria
 * manter duas telas de conversa.
 */
const AbaWhatsApp = ({ deal }) => {
  const classes = useStyles();
  const history = useHistory();

  const tickets = deal.tickets || [];

  if (tickets.length === 0) {
    return (
      <div className={classes.vazio}>
        <Typography variant="body2" color="textSecondary">
          Nenhuma conversa ligada a este orçamento.
        </Typography>
        <Typography variant="caption" color="textSecondary">
          O vínculo é criado ao abrir o pedido a partir de uma conversa.
        </Typography>
      </div>
    );
  }

  return (
    <>
      {tickets.map((ticket) => (
        <div key={ticket.id} className={classes.conversa}>
          <WhatsAppIcon className={classes.icone} />

          <div style={{ minWidth: 0, flex: 1 }}>
            <div className={classes.nome}>
              {ticket.contact?.name || `Conversa nº ${ticket.id}`}
            </div>
            <div className={classes.detalhe}>
              {ticket.contact?.number || ""}
              {ticket.status ? ` · ${ticket.status}` : ""}
              {ticket.user?.name ? ` · ${ticket.user.name}` : ""}
            </div>
            {ticket.lastMessage && (
              <div className={classes.ultima}>{ticket.lastMessage}</div>
            )}
          </div>

          <Button
            size="small"
            startIcon={<OpenInNewIcon />}
            onClick={() => history.push(`/tickets/${ticket.id}`)}
          >
            Abrir
          </Button>
        </div>
      ))}
    </>
  );
};

export default AbaWhatsApp;
