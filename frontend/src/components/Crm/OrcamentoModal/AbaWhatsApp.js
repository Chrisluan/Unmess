import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";

import makeStyles from "@mui/styles/makeStyles";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import { AuthContext } from "../../../context/Auth/AuthContext";
import EmptyState from "../../EmptyState";
import StatusChip from "../../StatusChip";

const useStyles = makeStyles((theme) => ({
  conversa: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 0,
    marginBottom: 8,
  },

  icone: { color: "#25d366", flexShrink: 0 },
  nome: { fontSize: 13.5, fontWeight: 600 },

  detalhe: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    fontSize: 11.5,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },

  ultima: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 380,
  },
}));

/**
 * Conversas de WhatsApp ligadas a este orçamento.
 *
 * Só lista e leva até lá: responder acontece na tela de atendimento, que tem o
 * histórico completo, os anexos e o compositor. Duplicar isso aqui significaria
 * manter duas telas de conversa.
 *
 * Quando não há vínculo mas o card tem contato, a aba abre a conversa em vez
 * de só informar que não existe nenhuma. Era o fim da linha do caminho
 * CRM → atendimento: quem estava com o orçamento aberto e queria falar com o
 * cliente tinha que decorar o nome, sair para Conversas e procurar lá.
 */
const AbaWhatsApp = ({ deal }) => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const [abrindo, setAbrindo] = useState(false);

  const tickets = deal.tickets || [];
  const contato = deal.contact;

  const iniciarConversa = async () => {
    if (!contato?.id) return;
    setAbrindo(true);
    try {
      const { data: ticket } = await api.post("/tickets", {
        contactId: contato.id,
        userId: user?.id,
        status: "open",
      });
      history.push(`/tickets/${ticket.id}`);
    } catch (err) {
      toastError(err);
      setAbrindo(false);
    }
  };

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={ForumOutlinedIcon}
        title="Nenhuma conversa ligada a este pedido"
        description={
          contato?.name
            ? `O vínculo nasce quando o pedido é aberto de dentro de uma conversa. Você também pode falar agora com ${contato.name}.`
            : "O vínculo nasce quando o pedido é aberto de dentro de uma conversa. Este card ainda não tem um contato de WhatsApp."
        }
        action={
          contato?.id && (
            <Button
              variant="contained"
              color="primary"
              disabled={abrindo}
              startIcon={<WhatsAppIcon />}
              onClick={iniciarConversa}
            >
              {abrindo ? "Abrindo…" : "Conversar com o cliente"}
            </Button>
          )
        }
      />
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
              {/* Vinha o valor cru do banco: "open", "pending", "closed". */}
              <StatusChip status={ticket.status} />
              {ticket.contact?.number && <span>{ticket.contact.number}</span>}
              {ticket.user?.name && <span>· {ticket.user.name}</span>}
            </div>
            {ticket.lastMessage && (
              <div className={classes.ultima}>{ticket.lastMessage}</div>
            )}
          </div>

          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={() => history.push(`/tickets/${ticket.id}`)}
          >
            Abrir conversa
          </Button>
        </div>
      ))}
    </>
  );
};

export default AbaWhatsApp;
