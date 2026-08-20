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
  etiquetas: { display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 },

  etiqueta: {
    fontSize: 9.5,
    fontWeight: 700,
    padding: "1px 5px",
    borderRadius: 3,
    color: "#fff",
    whiteSpace: "nowrap",
  },

  followUp: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    fontSize: 10.5,
    marginTop: 5,
  },

  followUpAtrasado: { color: "#b23b30", fontWeight: 700 },

  aguardando: {
    fontSize: 9.5,
    fontWeight: 600,
    padding: "1px 5px",
    borderRadius: 3,
    background: "rgba(150,105,10,.16)",
    color: "#96690a",
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

const CORES_PRIORIDADE = {
  urgent: "#b23b30",
  high: "#d97706",
  normal: "transparent",
  low: "#94a3b8",
};

const ROTULO_ATENDIMENTO = {
  waiting_customer: "Aguardando cliente",
  waiting_team: "Aguardando equipe",
};

/**
 * Follow-up em linguagem de quem opera.
 *
 * "Hoje 15:30" responde na hora; "19/08/2026 15:30" obriga a comparar com o
 * calendario mental antes de saber se e urgente.
 */
const descreverFollowUp = (iso) => {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;

  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const dias = Math.round((dia - hoje) / 86400000);
  const hora = format(data, "HH:mm");

  if (dias === 0) return { texto: `Hoje ${hora}`, atrasado: data < agora };
  if (dias === 1) return { texto: `Amanha ${hora}`, atrasado: false };
  if (dias === -1) return { texto: `Ontem ${hora}`, atrasado: true };
  if (dias < 0) return { texto: `Ha ${Math.abs(dias)} dias`, atrasado: true };
  return { texto: format(data, "dd/MM HH:mm"), atrasado: false };
};

const DealCard = ({ deal, arrastavel, arrastando, onDragStart, onDragEnd, onClick }) => {
  const classes = useStyles();

  const atrasado = estaAtrasado(deal.expectedCloseAt, deal.status);
  const previsao = paraData(deal.expectedCloseAt);
  const cliente = deal.customer?.tradeName || deal.customer?.name || deal.contact?.name;
  const followUp = descreverFollowUp(deal.nextFollowUpAt);
  // Atraso tem precedencia sobre prioridade na borda: uma oportunidade
  // atrasada e mais urgente que qualquer prioridade marcada a mao.
  const corPrioridade = CORES_PRIORIDADE[deal.priority] || "transparent";
  const aguardando = ROTULO_ATENDIMENTO[deal.serviceStatus];
  const etiquetas = deal.tags || [];

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
      style={
        !atrasado && corPrioridade !== "transparent"
          ? { borderLeftColor: corPrioridade }
          : undefined
      }
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

      {etiquetas.length > 0 && (
        <div className={classes.etiquetas}>
          {etiquetas.slice(0, 3).map((t) => (
            <span
              key={t.id}
              className={classes.etiqueta}
              style={{ background: t.color || "#607d8b" }}
            >
              {t.name}
            </span>
          ))}
          {/* Acima de tres, o card vira parede de etiqueta e some o resto. */}
          {etiquetas.length > 3 && (
            <span className={classes.etiqueta} style={{ background: "#90a4ae" }}>
              +{etiquetas.length - 3}
            </span>
          )}
        </div>
      )}

      {(followUp || aguardando) && (
        <div className={classes.followUp}>
          {followUp && (
            <span className={followUp.atrasado ? classes.followUpAtrasado : ""}>
              {followUp.atrasado ? "Atrasado: " : "Proximo: "}
              {followUp.texto}
            </span>
          )}
          {aguardando && <span className={classes.aguardando}>{aguardando}</span>}
        </div>
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
