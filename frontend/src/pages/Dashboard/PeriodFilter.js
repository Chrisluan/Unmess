import React, { useState } from "react";
import { startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";

import { Button, ButtonGroup, TextField, Popover, Box } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import DateRangeIcon from "@mui/icons-material/DateRange";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  barra: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  painel: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    width: 260,
  },
}));

/** Atalhos de período. "all" manda datas nulas e o backend não filtra. */
export const PRESETS = {
  today: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }),
  week: () => ({ start: startOfDay(subDays(new Date(), 6)), end: endOfDay(new Date()) }),
  month: () => ({ start: startOfMonth(new Date()), end: endOfDay(new Date()) }),
  all: () => ({ start: null, end: null }),
};

const paraInput = data =>
  data ? new Date(data.getTime() - data.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : "";

/**
 * Seletor de período do dashboard.
 *
 * Atalhos cobrem o uso do dia a dia; o intervalo manual existe para fechamento
 * de mês e comparações pontuais.
 */
const PeriodFilter = ({ value, onChange }) => {
  const classes = useStyles();
  const [anchor, setAnchor] = useState(null);
  const [inicio, setInicio] = useState(paraInput(value.start));
  const [fim, setFim] = useState(paraInput(value.end));

  const aplicarPreset = nome => {
    const { start, end } = PRESETS[nome]();
    setInicio(paraInput(start));
    setFim(paraInput(end));
    onChange({ preset: nome, start, end });
  };

  const aplicarManual = () => {
    if (!inicio || !fim) return;
    onChange({
      preset: "custom",
      start: startOfDay(new Date(`${inicio}T00:00:00`)),
      end: endOfDay(new Date(`${fim}T00:00:00`)),
    });
    setAnchor(null);
  };

  return (
    <div className={classes.barra}>
      <ButtonGroup size="small" variant="outlined">
        {["today", "week", "month", "all"].map(nome => (
          <Button
            key={nome}
            variant={value.preset === nome ? "contained" : "outlined"}
            onClick={() => aplicarPreset(nome)}
          >
            {i18n.t(`dashboard.period.${nome}`)}
          </Button>
        ))}
      </ButtonGroup>

      <Button
        size="small"
        variant={value.preset === "custom" ? "contained" : "outlined"}
        startIcon={<DateRangeIcon />}
        onClick={e => setAnchor(e.currentTarget)}
      >
        {i18n.t("dashboard.period.custom")}
      </Button>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { className: classes.painel } }}
      >
        <TextField
          type="date"
          size="small"
          label={i18n.t("dashboard.period.from")}
          InputLabelProps={{ shrink: true }}
          value={inicio}
          onChange={e => setInicio(e.target.value)}
        />
        <TextField
          type="date"
          size="small"
          label={i18n.t("dashboard.period.to")}
          InputLabelProps={{ shrink: true }}
          value={fim}
          onChange={e => setFim(e.target.value)}
        />
        <Box>
          <Button
            variant="contained"
            size="small"
            fullWidth
            disabled={!inicio || !fim || inicio > fim}
            onClick={aplicarManual}
          >
            {i18n.t("dashboard.period.apply")}
          </Button>
        </Box>
      </Popover>
    </div>
  );
};

export default PeriodFilter;
