import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import { Badge } from "@material-ui/core";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import QuestionAnswerOutlinedIcon from "@material-ui/icons/QuestionAnswerOutlined";
import BusinessOutlinedIcon from "@material-ui/icons/BusinessOutlined";
import SecurityIcon from "@material-ui/icons/Security";

import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";
import usePermissions from "../hooks/usePermissions";

function ListItemLink({ icon, primary, to, className }) {
  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  return (
    <li>
      <ListItem button component={renderLink} className={className}>
        {icon ? <ListItemIcon>{icon}</ListItemIcon> : null}
        <ListItemText primary={primary} />
      </ListItem>
    </li>
  );
}

const MainListItems = ({ drawerClose }) => {
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

  return (
    <div onClick={drawerClose}>
      {/* Dashboard */}
      <PermissionedItem permission="dashboard:access">
        <ListItemLink to="/" primary="Dashboard" icon={<DashboardOutlinedIcon />} />
      </PermissionedItem>

      {/* Conexões */}
      <PermissionedItem permission="connections:access">
        <ListItemLink
          to="/connections"
          primary={i18n.t("mainDrawer.listItems.connections")}
          icon={
            <Badge badgeContent={connectionWarning ? "!" : 0} color="error">
              <SyncAltIcon />
            </Badge>
          }
        />
      </PermissionedItem>

      {/* Conversas */}
      <PermissionedItem permission="tickets:access">
        <ListItemLink
          to="/tickets"
          primary={i18n.t("mainDrawer.listItems.tickets")}
          icon={<WhatsAppIcon />}
        />
      </PermissionedItem>

      {/* Contatos */}
      <PermissionedItem permission="contacts:access">
        <ListItemLink
          to="/contacts"
          primary={i18n.t("mainDrawer.listItems.contacts")}
          icon={<ContactPhoneOutlinedIcon />}
        />
      </PermissionedItem>

      {/* Respostas Rápidas */}
      <PermissionedItem permission="quickAnswers:access">
        <ListItemLink
          to="/quickAnswers"
          primary={i18n.t("mainDrawer.listItems.quickAnswers")}
          icon={<QuestionAnswerOutlinedIcon />}
        />
      </PermissionedItem>

      {/* Seção de administração — admin/super OU permissões específicas */}
      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>
            <Divider />
            <ListSubheader inset>
              {i18n.t("mainDrawer.listItems.administration")}
            </ListSubheader>
            <ListItemLink
              to="/users"
              primary={i18n.t("mainDrawer.listItems.users")}
              icon={<PeopleAltOutlinedIcon />}
            />
            <ListItemLink
              to="/permission-groups"
              primary={i18n.t("mainDrawer.listItems.permissionGroups")}
              icon={<SecurityIcon />}
            />
            <ListItemLink
              to="/Queues"
              primary={i18n.t("mainDrawer.listItems.queues")}
              icon={<AccountTreeOutlinedIcon />}
            />
            <ListItemLink
              to="/Settings"
              primary={i18n.t("mainDrawer.listItems.settings")}
              icon={<SettingsOutlinedIcon />}
            />
          </>
        )}
      />

      {/* Super admin */}
      <Can
        role={user.profile}
        perform="drawer-super-items:view"
        yes={() => (
          <>
            <Divider />
            <ListSubheader inset>
              {i18n.t("mainDrawer.listItems.superAdmin")}
            </ListSubheader>
            <ListItemLink
              to="/companies"
              primary={i18n.t("mainDrawer.listItems.companies")}
              icon={<BusinessOutlinedIcon />}
            />
          </>
        )}
      />
    </div>
  );
};

export default MainListItems;
