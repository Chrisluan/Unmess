import React from "react";

import makeStyles from "@mui/styles/makeStyles";

/**
 * Selo de estado, com a mesma gramática em toda a aplicação.
 *
 * Cor cheia só para o que é urgente (aguardando atendimento); contorno para
 * o resto. O tema tem uma cor de acento só, então usar azul cheio para
 * "em atendimento" faria o selo competir com os botões da mesma barra --
 * e "em atendimento" é o estado normal, o que menos precisa chamar atenção.
 */
const useStyles = makeStyles((theme) => ({
  selo: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    height: 20,
    padding: "0 7px",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    border: "1px solid currentColor",
  },

  pending: {
    color: theme.palette.warning.contrastText || "#fff",
    backgroundColor: theme.palette.warning.main,
    borderColor: theme.palette.warning.main,
  },

  open: {
    color: theme.palette.text.secondary,
  },

  closed: {
    color: theme.palette.success.main,
  },
}));

const ROTULOS = {
  pending: "Aguardando",
  open: "Em atendimento",
  closed: "Encerrada",
};

const StatusChip = ({ status, label }) => {
  const classes = useStyles();
  if (!status) return null;

  return (
    <span className={`${classes.selo} ${classes[status] || classes.open}`}>
      {label || ROTULOS[status] || status}
    </span>
  );
};

export default StatusChip;
