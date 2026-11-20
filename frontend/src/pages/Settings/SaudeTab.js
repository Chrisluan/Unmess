import React from "react";
import { useHistory } from "react-router-dom";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const useStyles = makeStyles((theme) => ({
  lista: { display: "flex", flexDirection: "column", gap: theme.spacing(1.5) },
  item: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    alignItems: "flex-start",
  },
  topo: { display: "flex", gap: theme.spacing(1), alignItems: "center", flexWrap: "wrap" },
  tudoCerto: {
    padding: theme.spacing(4),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1),
    textAlign: "center",
  },
}));

/**
 * O que está inconsistente nas configurações da empresa agora.
 *
 * "Bloqueia" é o que o sistema já recusaria se fosse gravado hoje -- veio de
 * antes da regra existir, ou de uma mudança em outra tela. "Aviso" depende
 * de estado (um número desconectado) e não impede nada.
 */
const SaudeTab = ({ problemas, carregando }) => {
  const classes = useStyles();
  const history = useHistory();

  if (carregando) return <CircularProgress size={24} />;

  if (!problemas.length) {
    return (
      <Paper variant="outlined" className={classes.tudoCerto}>
        <CheckCircleOutlineIcon color="success" fontSize="large" />
        <Typography variant="subtitle1">Tudo em ordem</Typography>
        <Typography variant="body2" color="text.secondary">
          Nenhuma configuração deixa outra sem efeito.
        </Typography>
      </Paper>
    );
  }

  const ordenados = [...problemas].sort(
    (a, b) => (a.severidade === "bloqueia" ? 0 : 1) - (b.severidade === "bloqueia" ? 0 : 1)
  );

  return (
    <div className={classes.lista}>
      {ordenados.map((p) => (
        <Paper key={`${p.regra}-${p.mensagem}`} variant="outlined" className={classes.item}>
          <div className={classes.topo}>
            <Chip
              size="small"
              color={p.severidade === "bloqueia" ? "error" : "warning"}
              label={p.severidade === "bloqueia" ? "Precisa resolver" : "Aviso"}
            />
            <Typography variant="subtitle2">{p.titulo}</Typography>
          </div>
          <Typography variant="body2" color="text.secondary">
            {p.mensagem}
          </Typography>
          {p.resolver?.rota && (
            <Button size="small" variant="outlined" onClick={() => history.push(p.resolver.rota)}>
              {p.resolver.rotulo}
            </Button>
          )}
        </Paper>
      ))}
    </div>
  );
};

export default SaudeTab;
