import React from "react";

import makeStyles from "@mui/styles/makeStyles";
import Tooltip from "@mui/material/Tooltip";

/**
 * Situação de acesso da empresa.
 *
 * Mesma gramática dos outros selos do sistema: contorno para o normal, cor
 * cheia só para o que exige ação. Uma empresa suspensa é a única coisa desta
 * tela que impede alguém de trabalhar agora, e é a única que ganha bloco de
 * cor.
 */
const useStyles = makeStyles((theme) => ({
  selo: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    height: 22,
    padding: "0 8px",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    border: "1px solid currentColor",
    flexShrink: 0,
  },

  active: {
    color: theme.palette.success.main,
  },

  suspended: {
    color: theme.palette.error.contrastText || "#fff",
    backgroundColor: theme.palette.error.main,
    borderColor: theme.palette.error.main,
  },

  canceled: {
    color: theme.palette.text.secondary,
  },
}));

const ROTULOS = {
  active: "Ativa",
  suspended: "Suspensa",
  canceled: "Cancelada",
};

const SituacaoEmpresa = ({ company }) => {
  const classes = useStyles();
  if (!company?.status) return null;

  const rotulo = ROTULOS[company.status] || company.status;

  // O motivo do bloqueio na dica: sem ele, "Suspensa" obriga a abrir a aba de
  // acesso para descobrir se foi inadimplência ou pedido do cliente.
  const dica = company.statusReason
    ? `${rotulo}: ${company.statusReason}`
    : rotulo;

  return (
    <Tooltip title={dica} arrow>
      <span
        className={`${classes.selo} ${classes[company.status] || classes.canceled}`}
      >
        {rotulo}
      </span>
    </Tooltip>
  );
};

export default SituacaoEmpresa;
