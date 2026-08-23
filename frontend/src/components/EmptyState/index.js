import React from "react";

import makeStyles from "@mui/styles/makeStyles";
import Typography from "@mui/material/Typography";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";

/**
 * Estado vazio padrão do sistema.
 *
 * Antes cada listagem resolvia o vazio do seu jeito: a maioria simplesmente
 * não resolvia -- a tabela ficava com o cabeçalho e nada embaixo, e quem
 * abria a tela pela primeira vez não sabia dizer se estava carregando, se
 * tinha dado erro ou se realmente não havia nada. Uma tela vazia precisa
 * dizer três coisas: que está vazia de propósito, por quê, e o que fazer a
 * seguir.
 *
 * O ícone é discreto (opacidade baixa, cor de texto secundário) porque o
 * protagonista aqui é a frase, não o desenho.
 */
const useStyles = makeStyles((theme) => ({
  raiz: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(6, 3),
    minHeight: 180,
    color: theme.palette.text.secondary,
  },

  icone: {
    fontSize: 40,
    opacity: 0.4,
    marginBottom: theme.spacing(0.5),
  },

  titulo: {
    fontWeight: 600,
    color: theme.palette.text.primary,
  },

  descricao: {
    maxWidth: 420,
  },

  acao: {
    marginTop: theme.spacing(1.5),
  },
}));

const EmptyState = ({ icon, title, description, action }) => {
  const classes = useStyles();
  const Icone = icon || InboxOutlinedIcon;

  return (
    <div className={classes.raiz}>
      <Icone className={classes.icone} />
      {title && (
        <Typography variant="subtitle1" className={classes.titulo}>
          {title}
        </Typography>
      )}
      {description && (
        <Typography variant="body2" className={classes.descricao}>
          {description}
        </Typography>
      )}
      {action && <div className={classes.acao}>{action}</div>}
    </div>
  );
};

export default EmptyState;
