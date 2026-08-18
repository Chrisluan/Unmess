import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";

import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import { Badge } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@mui/icons-material/ContactPhoneOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import SecurityIcon from "@mui/icons-material/Security";
import GroupWorkOutlinedIcon from "@mui/icons-material/GroupWorkOutlined";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";

import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";
import usePermissions from "../hooks/usePermissions";

const useStyles = makeStyles(theme => ({
  item: {
    borderRadius: 10,
    margin: theme.spacing(0.25, 1),
    paddingTop: 6,
    paddingBottom: 6,
    color: theme.palette.text.secondary,
    "&:hover": {
      backgroundColor:
        theme.palette.mode === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(37,118,210,0.06)"
    }
  },

  // O item ativo ganha fundo e cor da marca: sem isso não havia nenhuma
  // indicação de onde a pessoa está dentro do sistema.
  ativo: {
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(37,118,210,0.22)"
        : "rgba(37,118,210,0.10)",
    color: theme.palette.primary.main,
    "& $icone": { color: theme.palette.primary.main },
    "&:hover": {
      backgroundColor:
        theme.palette.mode === "dark"
          ? "rgba(37,118,210,0.30)"
          : "rgba(37,118,210,0.16)"
    }
  },

  icone: {
    minWidth: 40,
    color: "inherit"
  },

  texto: {
    "& .MuiTypography-root": {
      fontSize: "0.9rem",
      fontWeight: 500
    }
  },

  textoAtivo: {
    "& .MuiTypography-root": { fontWeight: 700 }
  },

  subheader: {
    lineHeight: "32px",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.palette.text.disabled,
    backgroundColor: "transparent"
  },

  divisor: {
    margin: theme.spacing(1, 2)
  }
}));

/**
 * Item de navegação.
 *
 * Usa ListItemButton porque o prop `button` do ListItem foi removido no MUI
 * v6 — mantê-lo deixava o item sem hover, foco nem ripple.
 *
 * Com a barra recolhida só o ícone aparece, então o rótulo vira tooltip: sem
 * isso a navegação fechada é adivinhação.
 */
function ListItemLink({ icon, primary, to, recolhida }) {
  const classes = useStyles();
  const { pathname } = useLocation();

  // "/" só casa exato; as demais casam por prefixo para a rota filha manter
  // o item do menu aceso.
  const ativo =
    to === "/" ? pathname === "/" : pathname.toLowerCase().startsWith(to.toLowerCase());

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  const item = (
    <ListItemButton
      component={renderLink}
      selected={ativo}
      className={`${classes.item} ${ativo ? classes.ativo : ""}`}
    >
      {icon ? <ListItemIcon className={classes.icone}>{icon}</ListItemIcon> : null}
      <ListItemText
        primary={primary}
        className={`${classes.texto} ${ativo ? classes.textoAtivo : ""}`}
      />
    </ListItemButton>
  );

  if (!recolhida) return item;

  return (
    <Tooltip title={primary} placement="right" arrow>
      <span>{item}</span>
    </Tooltip>
  );
}

const MainListItems = ({ drawerClose, recolhida = false }) => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);
  const { can, isAdmin } = usePermissions();
  const [connectionWarning, setConnectionWarning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offline = whatsApps.filter((w) =>
          ["qrcode", "PAIRING", "DISCONNECTED", "TIMEOUT", "OPENING"].includes(w.status)
        );
        setConnectionWarning(offline.length > 0);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [whatsApps]);

  // Helper para renderizar item condicionalmente (admin sempre vê, demais verificam permissão)
  const PermissionedItem = ({ permission, children }) => {
    if (!permission || isAdmin || can(permission)) return children;
    return null;
  };

  // Com a barra recolhida o título de seção não cabe; a linha divisória
  // sozinha já separa os grupos.
  const Secao = ({ children }) =>
    recolhida ? (
      <Divider className={classes.divisor} />
    ) : (
      <>
        <Divider className={classes.divisor} />
        <ListSubheader disableSticky className={classes.subheader}>
          {children}
        </ListSubheader>
      </>
    );

  return (
    <div onClick={drawerClose}>
      <PermissionedItem permission="dashboard:access">
        <ListItemLink to="/" primary="Dashboard" icon={<DashboardOutlinedIcon />} recolhida={recolhida} />
      </PermissionedItem>

      <PermissionedItem permission="tickets:access">
        <ListItemLink
          to="/tickets"
          primary={i18n.t("mainDrawer.listItems.tickets")}
          icon={<WhatsAppIcon />}
          recolhida={recolhida}
        />
      </PermissionedItem>

      <PermissionedItem permission="contacts:access">
        <ListItemLink
          to="/contacts"
          primary={i18n.t("mainDrawer.listItems.contacts")}
          icon={<ContactPhoneOutlinedIcon />}
          recolhida={recolhida}
        />
      </PermissionedItem>

      <PermissionedItem permission="clients:access">
        <ListItemLink
          to="/customers"
          primary={i18n.t("mainDrawer.listItems.customers")}
          icon={<GroupWorkOutlinedIcon />}
          recolhida={recolhida}
        />
      </PermissionedItem>

      <PermissionedItem permission="crm:access">
        <ListItemLink
          to="/crm"
          primary={i18n.t("mainDrawer.listItems.crm")}
          icon={<ViewKanbanOutlinedIcon />}
          recolhida={recolhida}
        />
      </PermissionedItem>

      <PermissionedItem permission="quickAnswers:access">
        <ListItemLink
          to="/quickAnswers"
          primary={i18n.t("mainDrawer.listItems.quickAnswers")}
          icon={<QuestionAnswerOutlinedIcon />}
          recolhida={recolhida}
        />
      </PermissionedItem>

      {/* Seção de administração — admin/super OU permissões específicas */}
      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>
            <Secao>{i18n.t("mainDrawer.listItems.administration")}</Secao>
            <ListItemLink
              to="/users"
              primary={i18n.t("mainDrawer.listItems.users")}
              icon={<PeopleAltOutlinedIcon />}
              recolhida={recolhida}
            />
            <ListItemLink
              to="/permission-groups"
              primary={i18n.t("mainDrawer.listItems.permissionGroups")}
              icon={<SecurityIcon />}
              recolhida={recolhida}
            />
            <ListItemLink
              to="/Queues"
              primary={i18n.t("mainDrawer.listItems.queues")}
              icon={<AccountTreeOutlinedIcon />}
              recolhida={recolhida}
            />
            {/* Conexões agora vive dentro de Configurações. O badge de alerta
                subiu para cá para o admin continuar vendo número caído. */}
            <ListItemLink
              to="/Settings"
              primary={i18n.t("mainDrawer.listItems.settings")}
              icon={
                <Badge badgeContent={connectionWarning ? "!" : 0} color="error">
                  <SettingsOutlinedIcon />
                </Badge>
              }
              recolhida={recolhida}
            />
          </>
        )}
      />

      <Can
        role={user.profile}
        perform="drawer-super-items:view"
        yes={() => (
          <>
            <Secao>{i18n.t("mainDrawer.listItems.superAdmin")}</Secao>
            <ListItemLink
              to="/companies"
              primary={i18n.t("mainDrawer.listItems.companies")}
              icon={<BusinessOutlinedIcon />}
              recolhida={recolhida}
            />
          </>
        )}
      />
    </div>
  );
};

export default MainListItems;
