import React from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import ButtonBase from "@mui/material/ButtonBase";
import makeStyles from "@mui/styles/makeStyles";

import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;
  return {
    abas: {
      display: "inline-flex",
      alignSelf: "flex-start",
      gap: 2,
      padding: 4,
      borderRadius: 12,
      backgroundColor: c.hover,
      flex: "none",
    },
    aba: {
      height: 34,
      padding: "0 16px",
      borderRadius: 9,
      fontSize: "0.875rem",
      fontWeight: 600,
      color: c.textoApagado,
    },
    ativa: {
      backgroundColor: c.superficie,
      color: c.texto,
      boxShadow: c.sombra,
    },
  };
});

const ABAS = [
  { para: "/contacts", rotulo: "Contatos", permissao: "contacts:access" },
  { para: "/customers", rotulo: "Clientes", permissao: "clients:access" },
];

const AbasContatos = () => {
  const classes = useStyles();
  const { pathname } = useLocation();
  const { can } = usePermissions();
  const visiveis = ABAS.filter((aba) => can(aba.permissao));

  if (visiveis.length < 2) return null;

  return (
    <nav className={classes.abas} aria-label="Contatos e clientes">
      {visiveis.map(({ para, rotulo }) => {
        const ativa = pathname.toLowerCase().startsWith(para);
        return (
          <ButtonBase
            key={para}
            component={RouterLink}
            to={para}
            className={`${classes.aba} ${ativa ? classes.ativa : ""}`}
            aria-current={ativa ? "page" : undefined}
          >
            {rotulo}
          </ButtonBase>
        );
      })}
    </nav>
  );
};

export default AbasContatos;
