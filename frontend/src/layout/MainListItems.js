import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";

import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import makeStyles from "@mui/styles/makeStyles";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import InsertChartOutlinedIcon from "@mui/icons-material/InsertChartOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";

import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import usePermissions from "../hooks/usePermissions";
import { ehRotaDeAjustes, secoesVisiveis } from "./ajustesItens";

const STATUS_DESCONECTADO = ["qrcode", "PAIRING", "DISCONNECTED", "TIMEOUT", "OPENING"];

export const useRailStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;
  return {
    item: {
      position: "relative",
      width: 68,
      minHeight: 56,
      borderRadius: 12,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      color: c.textoApagado,
      fontSize: "0.72rem",
      fontWeight: 600,
      lineHeight: 1.1,
      textAlign: "center",
      transition: "background-color .15s, color .15s",
      "&:hover": { backgroundColor: c.hover, color: c.texto },
      "& svg": { fontSize: 22 },
      [theme.breakpoints.down("sm")]: {
        width: "auto",
        flex: 1,
        minHeight: 54,
      },
    },
    ativo: {
      backgroundColor: c.primariaSuave,
      color: c.primariaSuaveTexto,
      "&:hover": { backgroundColor: c.primariaSuave, color: c.primariaSuaveTexto },
    },
    contador: {
      position: "absolute",
      top: 4,
      right: 12,
      minWidth: 20,
      height: 20,
      padding: "0 6px",
      borderRadius: 10,
      backgroundColor: c.sinal,
      color: c.sinalTexto,
      fontSize: "0.72rem",
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    alerta: {
      position: "absolute",
      top: 6,
      right: 14,
      minWidth: 18,
      height: 18,
      padding: "0 5px",
      borderRadius: 9,
      backgroundColor: c.erro,
      color: theme.palette.mode === "dark" ? "#121418" : "#fff",
      fontSize: "0.7rem",
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
  };
});

export const ItemTrilho = ({ to, rotulo, Icone, ativo, alerta, contador, dica, onClick, children }) => {
  const classes = useRailStyles();
  const conteudo = (
    <ButtonBase
      component={to ? RouterLink : "button"}
      to={to}
      onClick={onClick}
      className={`${classes.item} ${ativo ? classes.ativo : ""}`}
      aria-current={ativo ? "page" : undefined}
    >
      {children || <Icone />}
      <span>{rotulo}</span>
      {contador ? <span className={classes.contador}>{contador > 99 ? "99+" : contador}</span> : null}
      {alerta ? <span className={classes.alerta}>{alerta}</span> : null}
    </ButtonBase>
  );
  if (!dica) return conteudo;
  return (
    <Tooltip title={dica} placement="right">
      {conteudo}
    </Tooltip>
  );
};

const MainListItems = () => {
  const { pathname } = useLocation();
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);
  const { can } = usePermissions();
  const [numeroCaido, setNumeroCaido] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNumeroCaido(whatsApps.some((w) => STATUS_DESCONECTADO.includes(w.status)));
    }, 2000);
    return () => clearTimeout(timer);
  }, [whatsApps]);

  const caminho = pathname.toLowerCase();
  const ajustes = secoesVisiveis({ can, ehSuper: user?.profile === "super" });
  const primeiroAjuste = ajustes[0]?.itens[0]?.para;

  return (
    <>
      {can("tickets:view") && (
        <ItemTrilho
          to="/tickets"
          rotulo="Conversas"
          Icone={ChatBubbleOutlineIcon}
          ativo={caminho.startsWith("/tickets")}
        />
      )}
      {can("crm:view") && (
        <ItemTrilho to="/crm" rotulo="Funil" Icone={ViewKanbanOutlinedIcon} ativo={caminho.startsWith("/crm")} />
      )}
      {(can("contacts:view") || can("clients:view")) && (
        <ItemTrilho
          to={can("contacts:view") ? "/contacts" : "/customers"}
          rotulo="Contatos"
          Icone={PeopleAltOutlinedIcon}
          ativo={caminho.startsWith("/contacts") || caminho.startsWith("/customers")}
        />
      )}
      {can("dashboard:view") && (
        <ItemTrilho to="/" rotulo="Painel" Icone={InsertChartOutlinedIcon} ativo={caminho === "/"} />
      )}
      {primeiroAjuste && (
        <ItemTrilho
          to={numeroCaido && can("settings:view") ? "/Settings?aba=conexoes" : primeiroAjuste}
          rotulo="Ajustes"
          Icone={SettingsOutlinedIcon}
          ativo={ehRotaDeAjustes(caminho)}
          alerta={numeroCaido && can("settings:view") ? "!" : null}
          dica={numeroCaido && can("settings:view") ? "Um número de WhatsApp está desconectado" : null}
        />
      )}
    </>
  );
};

export default MainListItems;
