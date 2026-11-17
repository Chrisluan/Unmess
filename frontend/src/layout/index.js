import React, { useState, useContext } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  Avatar,
  Button,
  ButtonBase,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import makeStyles from "@mui/styles/makeStyles";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import TextIncreaseIcon from "@mui/icons-material/TextIncrease";
import TextDecreaseIcon from "@mui/icons-material/TextDecrease";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import LogoutIcon from "@mui/icons-material/Logout";

import MainListItems, { ItemTrilho } from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import { useBranding } from "../context/Branding";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import { useThemeContext } from "../context/DarkMode";
import usePermissions from "../hooks/usePermissions";
import { ehRotaDeAjustes, secoesVisiveis, itemAtivo } from "./ajustesItens";

const useStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;
  return {
    root: {
      display: "grid",
      gridTemplateColumns: "84px minmax(0, 1fr)",
      height: "100vh",
      "@supports (height: 100dvh)": { height: "100dvh" },
      [theme.breakpoints.down("sm")]: {
        gridTemplateColumns: "minmax(0, 1fr)",
        gridTemplateRows: "minmax(0, 1fr) auto",
      },
    },
    trilho: {
      backgroundColor: c.superficie,
      borderRight: `1px solid ${c.linha}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      padding: "16px 0 12px",
      overflowY: "auto",
      overflowX: "hidden",
      ...theme.scrollbarStyles,
      [theme.breakpoints.down("sm")]: {
        gridRow: 2,
        flexDirection: "row",
        justifyContent: "space-around",
        padding: "4px 6px",
        paddingBottom: "max(4px, env(safe-area-inset-bottom))",
        gap: 2,
        borderRight: 0,
        borderTop: `1px solid ${c.linha}`,
        overflow: "visible",
      },
    },
    marca: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      minHeight: 36,
      color: c.texto,
      textDecoration: "none",
      [theme.breakpoints.down("sm")]: { display: "none" },
    },
    marcaLogo: { width: 36, height: 36, borderRadius: 10, objectFit: "contain" },
    marcaTexto: { fontWeight: 700, fontSize: 24, letterSpacing: "-0.03em", lineHeight: 1 },
    marcaPonto: {
      display: "inline-block",
      width: 6,
      height: 6,
      borderRadius: "50%",
      backgroundColor: "#B0FB02",
      marginLeft: 1,
      boxShadow: "0 0 0 1px rgba(0,0,0,.08)",
    },
    separador: {
      width: 32,
      height: 1,
      backgroundColor: c.linha,
      margin: "6px 0",
      flex: "none",
      [theme.breakpoints.down("sm")]: { display: "none" },
    },
    espaco: { flex: 1, [theme.breakpoints.down("sm")]: { display: "none" } },
    soDesktop: { [theme.breakpoints.down("sm")]: { display: "none !important" } },
    avisos: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      "& .MuiIconButton-root": { color: c.textoApagado },
    },
    eu: {
      marginTop: 6,
      borderRadius: "50%",
      position: "relative",
      "&::after": {
        content: '""',
        position: "absolute",
        right: -1,
        bottom: -1,
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: c.sinal,
        border: `2px solid ${c.superficie}`,
      },
    },
    euAvatar: {
      width: 38,
      height: 38,
      fontSize: 14,
      backgroundColor: c.primaria,
      color: c.primariaTexto,
    },
    principal: {
      minWidth: 0,
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
    faixaSuper: {
      flex: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "6px 16px",
      fontSize: "0.8125rem",
      backgroundColor: c.atencaoSuave,
      color: c.texto,
      borderBottom: `1px solid ${c.linha}`,
    },
    conteudo: {
      flex: 1,
      minHeight: 0,
      overflow: "auto",
      display: "flex",
      flexDirection: "column",
      ...theme.scrollbarStyles,
    },
    ajustes: {
      flex: 1,
      minHeight: 0,
      display: "grid",
      gridTemplateColumns: "250px minmax(0, 1fr)",
      [theme.breakpoints.down("md")]: {
        gridTemplateColumns: "minmax(0, 1fr)",
        gridTemplateRows: "auto minmax(0, 1fr)",
      },
    },
    ajustesNav: {
      backgroundColor: c.superficie,
      borderRight: `1px solid ${c.linha}`,
      padding: "24px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 2,
      overflowY: "auto",
      ...theme.scrollbarStyles,
      [theme.breakpoints.down("md")]: {
        flexDirection: "row",
        borderRight: 0,
        borderBottom: `1px solid ${c.linha}`,
        padding: "10px 12px",
        overflowX: "auto",
        gap: 6,
      },
    },
    ajustesTitulo: {
      padding: "16px 12px 6px",
      fontSize: "0.78rem",
      fontWeight: 600,
      color: c.textoApagado,
      "&:first-child": { paddingTop: 0 },
      [theme.breakpoints.down("md")]: { display: "none" },
    },
    ajustesItem: {
      justifyContent: "flex-start",
      gap: 10,
      padding: "9px 12px",
      borderRadius: 10,
      color: c.texto2,
      fontWeight: 500,
      fontSize: "0.875rem",
      textAlign: "left",
      "& svg": { fontSize: 19, color: c.textoApagado },
      "&:hover": { backgroundColor: c.hover },
      [theme.breakpoints.down("md")]: {
        flex: "none",
        whiteSpace: "nowrap",
        border: `1px solid ${c.linha}`,
        borderRadius: 999,
        padding: "6px 12px",
      },
    },
    ajustesItemAtivo: {
      backgroundColor: c.primariaSuave,
      color: c.primariaSuaveTexto,
      fontWeight: 600,
      "& svg": { color: c.primariaSuaveTexto },
      "&:hover": { backgroundColor: c.primariaSuave },
      [theme.breakpoints.down("md")]: { borderColor: "transparent" },
    },
    ajustesConteudo: {
      minWidth: 0,
      minHeight: 0,
      overflow: "auto",
      display: "flex",
      flexDirection: "column",
      ...theme.scrollbarStyles,
    },
  };
});

const iniciais = (nome = "") =>
  nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

const NavegacaoAjustes = () => {
  const classes = useStyles();
  const location = useLocation();
  const { can } = usePermissions();
  const { user } = useContext(AuthContext);
  const secoes = secoesVisiveis({ can, ehSuper: user?.profile === "super" });

  return (
    <nav className={classes.ajustesNav} aria-label="Ajustes">
      {secoes.map((secao) => (
        <React.Fragment key={secao.titulo}>
          <span className={classes.ajustesTitulo}>{secao.titulo}</span>
          {secao.itens.map(({ rotulo, para, Icone }) => {
            const ativo = itemAtivo({ para }, location);
            return (
              <ButtonBase
                key={para}
                component={RouterLink}
                to={para}
                className={`${classes.ajustesItem} ${ativo ? classes.ajustesItemAtivo : ""}`}
                aria-current={ativo ? "page" : undefined}
              >
                <Icone />
                {rotulo}
              </ButtonBase>
            );
          })}
        </React.Fragment>
      ))}
    </nav>
  );
};

const LoggedInLayout = ({ children }) => {
  const classes = useStyles();
  const theme = useTheme();
  const celular = useMediaQuery(theme.breakpoints.down("sm"));
  const { pathname } = useLocation();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const { handleLogout, handleLeaveCompany, loading, user } = useContext(AuthContext);
  const { name: brandName, logo: brandLogo } = useBranding();
  const { darkMode, toggleTheme, textoGrande, toggleTextoGrande } = useThemeContext();

  const isSuperInCompany = user?.profile === "super" && !!user?.companyId;

  const fecharMenu = () => setMenuAnchor(null);

  if (loading) {
    return <BackdropLoading />;
  }

  const avatar = (
    <Avatar className={classes.euAvatar} alt={user?.name}>
      {iniciais(user?.name)}
    </Avatar>
  );

  return (
    <div className={classes.root}>
      <nav className={classes.trilho} aria-label="Navegação principal">
        <RouterLink to="/" className={classes.marca} aria-label={brandName}>
          {brandLogo ? (
            <img src={brandLogo} alt={brandName} className={classes.marcaLogo} />
          ) : (
            <span className={classes.marcaTexto}>
              u<span className={classes.marcaPonto} />
            </span>
          )}
        </RouterLink>

        <MainListItems />

        <div className={classes.espaco} />
        <div className={classes.separador} />

        <div className={classes.soDesktop}>
          <ItemTrilho
            rotulo="Texto"
            Icone={textoGrande ? TextDecreaseIcon : TextIncreaseIcon}
            ativo={textoGrande}
            onClick={toggleTextoGrande}
            dica={textoGrande ? "Voltar ao texto normal" : "Aumentar o texto"}
          />
        </div>
        <div className={classes.soDesktop}>
          <ItemTrilho
            rotulo={darkMode ? "Claro" : "Escuro"}
            Icone={darkMode ? LightModeOutlinedIcon : DarkModeOutlinedIcon}
            onClick={toggleTheme}
            dica={darkMode ? "Usar tema claro" : "Usar tema escuro"}
          />
        </div>
        <div className={`${classes.avisos} ${classes.soDesktop}`}>
          {user.id && <NotificationsPopOver />}
        </div>

        {celular ? (
          <ItemTrilho rotulo="Você" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <Avatar className={classes.euAvatar} style={{ width: 26, height: 26, fontSize: 11 }}>
              {iniciais(user?.name)}
            </Avatar>
          </ItemTrilho>
        ) : (
          <Tooltip title={`${user?.name || ""} · disponível`} placement="right">
            <ButtonBase
              className={classes.eu}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label="Abrir menu da conta"
            >
              {avatar}
            </ButtonBase>
          </Tooltip>
        )}

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={fecharMenu}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          transformOrigin={celular ? { vertical: "bottom", horizontal: "right" } : { vertical: "bottom", horizontal: "left" }}
        >
          <MenuItem
            onClick={() => {
              setUserModalOpen(true);
              fecharMenu();
            }}
          >
            <ListItemIcon><PersonOutlineIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{i18n.t("mainDrawer.appBar.user.profile")}</ListItemText>
          </MenuItem>
          <MenuItem onClick={toggleTextoGrande}>
            <ListItemIcon>{textoGrande ? <TextDecreaseIcon fontSize="small" /> : <TextIncreaseIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{textoGrande ? "Texto normal" : "Texto maior"}</ListItemText>
          </MenuItem>
          <MenuItem onClick={toggleTheme}>
            <ListItemIcon>{darkMode ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{darkMode ? "Tema claro" : "Tema escuro"}</ListItemText>
          </MenuItem>
          <Divider />
          {isSuperInCompany && (
            <MenuItem
              onClick={() => {
                fecharMenu();
                handleLeaveCompany();
              }}
            >
              <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Trocar empresa</ListItemText>
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              fecharMenu();
              handleLogout();
            }}
          >
            <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{i18n.t("mainDrawer.appBar.user.logout")}</ListItemText>
          </MenuItem>
        </Menu>
      </nav>

      <main className={classes.principal}>
        <UserModal open={userModalOpen} onClose={() => setUserModalOpen(false)} userId={user?.id} />
        {isSuperInCompany && (
          <div className={classes.faixaSuper}>
            <span>
              Você está na empresa <strong>{user.companyName || `#${user.companyId}`}</strong> como Super Admin.
            </span>
            <Button size="small" variant="outlined" onClick={handleLeaveCompany}>
              Trocar empresa
            </Button>
          </div>
        )}
        {ehRotaDeAjustes(pathname) ? (
          <div className={classes.ajustes}>
            <NavegacaoAjustes />
            <div className={classes.ajustesConteudo}>{children}</div>
          </div>
        ) : (
          <div className={classes.conteudo}>{children || null}</div>
        )}
      </main>
    </div>
  );
};

export default LoggedInLayout;
