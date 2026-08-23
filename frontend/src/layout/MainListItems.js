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
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@mui/icons-material/ContactPhoneOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import SecurityIcon from "@mui/icons-material/Security";
import GroupWorkOutlinedIcon from "@mui/icons-material/GroupWorkOutlined";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";

import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import usePermissions from "../hooks/usePermissions";

const useStyles = makeStyles(theme => ({
  /**
   * Item de navegação.
   *
   * Ocupa a largura inteira da barra, sem margem lateral nem canto: a lista
   * lida como uma coluna contínua, e não como uma pilha de pastilhas soltas.
   * A barra de 3px à esquerda fica transparente aqui e ganha cor no item
   * ativo -- reservar o espaço desde já evita que o texto ande um pouco para
   * o lado toda vez que se troca de tela.
   */
  item: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 13,
    color: theme.palette.text.secondary,
    borderLeft: "3px solid transparent",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.primary
    }
  },

  /**
   * Onde a pessoa está.
   *
   * A marcação é a barra azul na borda, e não um bloco de fundo colorido: com
   * canto reto, o bloco encostaria nas divisórias e viraria mais uma faixa
   * entre outras. A barra na margem é inequívoca e não disputa com o texto.
   */
  ativo: {
    backgroundColor: theme.palette.action.selected,
    borderLeftColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
    "& $icone": { color: theme.palette.primary.main },
    "&:hover": {
      backgroundColor: theme.palette.action.focus,
      color: theme.palette.primary.main
    }
  },

  icone: {
    minWidth: 38,
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
    lineHeight: "28px",
    paddingLeft: 16,
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    backgroundColor: "transparent"
  },

  // A divisória atravessa a barra inteira: recuada, ela desenharia um degrau
  // contra a borda reta da lateral.
  divisor: {
    margin: theme.spacing(1, 0, 0.5)
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

  const renderLink = React.useMemo(() => {
    const Link = React.forwardRef((itemProps, ref) => (
      <RouterLink to={to} ref={ref} {...itemProps} />
    ));
    // Sem displayName o componente aparece como "ForwardRef" no React
    // DevTools e no aviso do lint — e são doze deles na barra.
    Link.displayName = `NavLink(${to})`;
    return Link;
  }, [to]);

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
  const { can, canAny } = usePermissions();
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

  /**
   * Item da barra que só aparece para quem tem a permissão.
   *
   * Não existe mais exceção para administrador: o cargo de Administrador tem
   * todas as permissões, então ele passa por aqui pelo caminho normal, como
   * todo mundo. Enquanto havia um atalho, um cargo com `queues:view` não fazia
   * o item Filas aparecer — a seção inteira de administração era mostrada por
   * "é admin?", e quem não fosse admin simplesmente não a via, por mais
   * permissões que tivesse.
   */
  const PermissionedItem = ({ permission, children }) => {
    if (foraDeEmpresa) return null;
    if (!permission || can(permission)) return children;
    return null;
  };

  // Com a barra recolhida o título de seção não cabe; a linha divisória
  // sozinha já separa os grupos.
  const Secao = ({ children, primeira = false }) => {
    if (recolhida) return primeira ? null : <Divider className={classes.divisor} />;
    return (
      <>
        {!primeira && <Divider className={classes.divisor} />}
        <ListSubheader disableSticky className={classes.subheader}>
          {children}
        </ListSubheader>
      </>
    );
  };

  // Um bloco inteiro sem nenhum item permitido não pode deixar o título e a
  // divisória sozinhos na barra.
  // O super só passa a ver a operação depois de entrar em alguma empresa.
  const foraDeEmpresa = user?.profile === "super" && !user?.companyId;

  const podeComercial =
    !foraDeEmpresa &&
    canAny([
      "crm:view",
      "clients:view",
      "contacts:view",
      "products:view",
      "finance:view",
    ]);

  const podeAdministrar =
    !foraDeEmpresa &&
    canAny([
      "users:view",
      "roles:view",
      "queues:view",
      "quickAnswers:view",
      "tags:view",
      "settings:view",
      "connections:view",
    ]);

  const ehSuper = user?.profile === "super";

  return (
    <div onClick={drawerClose}>
      {!foraDeEmpresa && (
        <Secao primeira>{i18n.t("mainDrawer.sections.operation")}</Secao>
      )}

      <PermissionedItem permission="dashboard:view">
        <ListItemLink
          to="/"
          primary={i18n.t("mainDrawer.listItems.dashboard")}
          icon={<DashboardOutlinedIcon />}
          recolhida={recolhida}
        />
      </PermissionedItem>

      <PermissionedItem permission="tickets:view">
        <ListItemLink
          to="/tickets"
          primary={i18n.t("mainDrawer.listItems.tickets")}
          icon={<ForumOutlinedIcon />}
          recolhida={recolhida}
        />
      </PermissionedItem>

      {podeComercial && (
        <>
          <Secao>{i18n.t("mainDrawer.sections.commercial")}</Secao>

          <PermissionedItem permission="crm:view">
            <ListItemLink
              to="/crm"
              primary={i18n.t("mainDrawer.listItems.crm")}
              icon={<ViewKanbanOutlinedIcon />}
              recolhida={recolhida}
            />
          </PermissionedItem>

          <PermissionedItem permission="clients:view">
            <ListItemLink
              to="/customers"
              primary={i18n.t("mainDrawer.listItems.customers")}
              icon={<GroupWorkOutlinedIcon />}
              recolhida={recolhida}
            />
          </PermissionedItem>

          <PermissionedItem permission="contacts:view">
            <ListItemLink
              to="/contacts"
              primary={i18n.t("mainDrawer.listItems.contacts")}
              icon={<ContactPhoneOutlinedIcon />}
              recolhida={recolhida}
            />
          </PermissionedItem>

          <PermissionedItem permission="products:view">
            <ListItemLink
              to="/products"
              primary={i18n.t("mainDrawer.listItems.products")}
              icon={<Inventory2OutlinedIcon />}
              recolhida={recolhida}
            />
          </PermissionedItem>

          <PermissionedItem permission="finance:view">
            <ListItemLink
              to="/finance"
              primary={i18n.t("mainDrawer.listItems.finance")}
              icon={<PaymentsOutlinedIcon />}
              recolhida={recolhida}
            />
          </PermissionedItem>
        </>
      )}

      {/*
        Administração, item a item.

        Antes o bloco inteiro era um "é admin?": quem não fosse admin não via
        nada aqui, por mais permissões que tivesse — com uma única exceção
        costurada à mão para Respostas Rápidas. Era o sintoma mais visível do
        profile decidindo o que o cargo deveria decidir. Agora cada linha
        pergunta pela sua própria permissão, e a seção só aparece se sobrar ao
        menos uma.
      */}
      {podeAdministrar && (
        <>
          <Secao>{i18n.t("mainDrawer.sections.administration")}</Secao>

          <PermissionedItem permission="users:view">
            <ListItemLink
              to="/users"
              primary={i18n.t("mainDrawer.listItems.users")}
              icon={<PeopleAltOutlinedIcon />}
              recolhida={recolhida}
            />
          </PermissionedItem>

          <PermissionedItem permission="roles:view">
            <ListItemLink
              to="/roles"
              primary={i18n.t("mainDrawer.listItems.roles")}
              icon={<SecurityIcon />}
              recolhida={recolhida}
            />
          </PermissionedItem>

          <PermissionedItem permission="queues:view">
            <ListItemLink
              to="/Queues"
              primary={i18n.t("mainDrawer.listItems.queues")}
              icon={<AccountTreeOutlinedIcon />}
              recolhida={recolhida}
            />
          </PermissionedItem>

          <PermissionedItem permission="quickAnswers:view">
            <ListItemLink
              to="/quickAnswers"
              primary={i18n.t("mainDrawer.listItems.quickAnswers")}
              icon={<QuestionAnswerOutlinedIcon />}
              recolhida={recolhida}
            />
          </PermissionedItem>

          {/* Conexões e Etiquetas vivem dentro de Configurações, cada uma com
              permissão própria — por isso a entrada aceita as três. O badge de
              alerta subiu para cá para quem cuida das conexões continuar vendo
              número caído sem abrir a tela. */}
          {canAny(["settings:view", "connections:view", "tags:view"]) && (
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
          )}
        </>
      )}

      {ehSuper && (
        <>
          <Secao primeira={foraDeEmpresa}>
            {i18n.t("mainDrawer.sections.platform")}
          </Secao>
          <ListItemLink
            to="/companies"
            primary={i18n.t("mainDrawer.listItems.companies")}
            icon={<BusinessOutlinedIcon />}
            recolhida={recolhida}
          />
        </>
      )}
    </div>
  );
};

export default MainListItems;
