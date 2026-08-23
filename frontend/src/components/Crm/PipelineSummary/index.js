import React from "react";
import makeStyles from "@mui/styles/makeStyles";
import Typography from "@mui/material/Typography";

import { i18n } from "../../../translate/i18n";
import { formatarValor } from "../formatters";

const useStyles = makeStyles((theme) => ({
  faixa: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(3),
    padding: theme.spacing(1, 2),
    marginBottom: theme.spacing(1),
    borderRadius: 0,
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(11,92,255,0.05)",
  },

  indicador: {
    display: "flex",
    flexDirection: "column",
  },

  rotulo: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.palette.text.disabled,
  },

  valor: {
    fontSize: "1.05rem",
    fontWeight: 700,
  },

  ganho: {
    color: theme.palette.success.main,
  },
}));

/**
 * Números do funil inteiro, incluindo negócios já fechados que o board esconde.
 * Vêm calculados do backend justamente por isso.
 */
const PipelineSummary = ({ summary }) => {
  const classes = useStyles();

  if (!summary) return null;

  // Cada jornada entra uma vez só, no estágio mais avançado que alcançou —
  // como cada quadro gera um card novo, somar cards multiplicaria a venda.
  const indicadores = [
    {
      rotulo: i18n.t("crm.summary.pipeline"),
      valor: formatarValor(summary.pipelineValue),
      detalhe: i18n.t("crm.summary.deals", { count: summary.pipelineCount }),
    },
    {
      rotulo: i18n.t("crm.summary.inProgress"),
      valor: formatarValor(summary.inProgressValue),
      detalhe: i18n.t("crm.summary.deals", { count: summary.inProgressCount }),
    },
    {
      rotulo: i18n.t("crm.summary.billed"),
      valor: formatarValor(summary.billedValue),
      detalhe: i18n.t("crm.summary.deals", { count: summary.billedCount }),
      destaque: true,
    },
    {
      rotulo: i18n.t("crm.summary.conversion"),
      valor: `${summary.conversionRate}%`,
      detalhe: i18n.t("crm.summary.lost", { count: summary.lostCount }),
    },
  ];

  return (
    <div className={classes.faixa}>
      {indicadores.map((indicador) => (
        <div key={indicador.rotulo} className={classes.indicador}>
          <span className={classes.rotulo}>{indicador.rotulo}</span>
          <span
            className={`${classes.valor} ${
              indicador.destaque ? classes.ganho : ""
            }`}
          >
            {indicador.valor}
          </span>
          <Typography variant="caption" color="textSecondary">
            {indicador.detalhe}
          </Typography>
        </div>
      ))}
    </div>
  );
};

export default PipelineSummary;
