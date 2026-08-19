import React from "react";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";

import { formatarValor, paraData, estaAtrasado } from "../formatters";

const useStyles = makeStyles((theme) => ({
  card: {
    padding: theme.spacing(1.25),
    borderRadius: 8,
    cursor: "pointer",
    borderLeft: "3px solid transparent",
    transition: "box-shadow 120ms, transform 120ms",
    "&:hover": {
      boxShadow: theme.shadows[3],
    },
  },

  arrastavel: {
    cursor: "grab",
  },

  // O card em movimento fica esmaecido para a linha de inserção ficar legível.
  arrastando: {
    opacity: 0.4,
  },

  atrasado: {
    borderLeftColor: theme.palette.error.main,
  },

  faixa: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },

  concluido: {
    fontSize: 9.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "1px 5px",
    borderRadius: 3,
    background: "rgba(26,122,85,.14)",
    color: "#1a7a55",
  },

  // Referência ao card de origem: discreta, porque é rastreio e não conteúdo.
  origem: {
    fontSize: 9.5,
    fontWeight: 600,
    padding: "1px 5px",
    borderRadius: 3,
    background: "rgba(0,0,0,.06)",
    opacity: 0.8,
  },
  titulo: {
    fontWeight: 600,
    fontSize: "0.875rem",
    lineHeight: 1.3,
    wordBreak: "break-word",
  },

  cliente: {
    display: "block",
    marginTop: 2,
  },

  rodape: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },

  valor: {
    fontWeight: 700,
    fontSize: "0.85rem",
    color: theme.palette.success.main,
  },

  prazo: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    fontSize: "0.72rem",
    color: theme.palette.text.secondary,
  },

  prazoAtrasado: {
    color: theme.palette.error.main,
    fontWeight: 600,
  },

  avatar: {
    width: 22,
    height: 22,
    fontSize: "0.7rem",
  },
}));

const iniciais = (nome) =>
  (nome || "?")
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("");

const DealCard = ({ deal, arrastavel, arrastando, onDragStart, onDragEnd, onClick }) => {
  const classes = useStyles();

  const atrasado = estaAtrasado(deal.expectedCloseAt, deal.status);
  const previsao = paraData(deal.expectedCloseAt);
  const cliente = deal.customer?.tradeName || deal.customer?.name || deal.contact?.name;

  return (
    <Paper
      variant="outlined"
      draggable={arrastavel}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={[
        classes.card,
        arrastavel ? classes.arrastavel : "",
        arrastando ? classes.arrastando : "",
        atrasado ? classes.atrasado : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* O card concluído continua no quadro (antes sumia), então precisa dizer
          que já passou. E o card gerado adiante mostra de onde veio -- é o elo
          entre o orçamento e o trabalho que ele originou. */}
      {(deal.status === "moved" || deal.previousDealId) && (
        <div className={classes.faixa}>
          {deal.status === "moved" && <span className={classes.concluido}>Concluído</span>}
          {deal.previousDealId && (
            <span className={classes.origem}>Orçamento nº {deal.previousDealId}</span>
          )}
        </div>
      )}

      <Typography className={classes.titulo}>{deal.title}</Typography>

      {cliente && (
        <Typography
          variant="caption"
          color="textSecondary"
          className={classes.cliente}
        >
          {cliente}
        </Typography>
      )}

      <div className={classes.rodape}>
        <span className={classes.valor}>{formatarValor(deal.value)}</span>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {previsao && (
            <span
              className={`${classes.prazo} ${
                atrasado ? classes.prazoAtrasado : ""
              }`}
            >
              <EventOutlinedIcon style={{ fontSize: 13 }} />
              {format(previsao, "dd/MM", { locale: ptBR })}
            </span>
          )}

          {deal.responsibleUser && (
            <Tooltip title={deal.responsibleUser.name} arrow>
              <Avatar className={classes.avatar}>
                {iniciais(deal.responsibleUser.name)}
              </Avatar>
            </Tooltip>
          )}
        </div>
      </div>
    </Paper>
  );
};

export default DealCard;
