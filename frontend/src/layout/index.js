import React, { useState, useContext, useEffect } from "react";
import clsx from "clsx";
import { useLocation } from "react-router-dom";
import {
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  ListItemText,
  MenuItem,
  IconButton,
  Menu,
  Button,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import makeStyles from '@mui/styles/makeStyles';
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AccountCircle from "@mui/icons-material/AccountCircle";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import Tooltip from "@mui/material/Tooltip";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import { useBranding } from "../context/Branding";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import { useThemeContext } from "../context/DarkMode";
import { tituloDaRota } from "../constants/navigation";

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    [theme.breakpoints.down('md')]: {
      height: "calc(100vh - 56px)",
    },
  },
  toolbar: {
    paddingRight: 24, // keep right padding when drawer closed
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "0 4px 0 12px",
    // Mesma altura da barra superior: o desencontro deixava um degrau visível
    // exatamente na quina entre as duas.
    minHeight: "48px",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  brandBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0, // deixa o noWrap do nome funcionar em vez de estourar a barra
    paddingLeft: 4,
  },

  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: 0,
    objectFit: "contain",
    flexShrink: 0,
  },

  // Sem logo, a inicial do nome dá alguma identidade em vez de espaço vazio.
  brandInitial: {
    width: 28,
    height: 28,
    borderRadius: 0,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "0.9rem",
    color: "#fff",
    backgroundColor: theme.palette.primary.main,
  },

  brandName: {
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: theme.palette.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    // Superfície própria, separada do conteúdo pela borda que o tema aplica.
    // Antes usava a cor de fundo da página e as duas se confundiam.
    color: theme.palette.text.primary,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    backgroundColor: theme.palette.background.paper,
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  menuButton: {
    marginRight: 36,
    color: theme.palette.text.primary,
  },
  menuButtonHidden: {
    display: "none",
  },
  title: {
    flexGrow: 1,
    color: theme.palette.text.primary,
  },

  // Cabeçalho do menu da conta: quem está logado e com que e-mail. Sem isso,
  // numa máquina compartilhada só dava para descobrir abrindo o perfil.
  identidade: {
    padding: theme.spacing(1, 2),
    maxWidth: 260,
  },

  nomeUsuario: {
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  emailUsuario: {
    color: theme.palette.text.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      // easeInOut em vez de sharp: recolher/expandir fica menos brusco.
      easing: theme.transitions.easing.easeInOut,
      duration: theme.transitions.duration.standard,
    }),
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    ...theme.scrollbarStyles,
  },
  drawerPaperClose: {
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.easeInOut,
      duration: theme.transitions.duration.standard,
    }),
    // Largura suficiente para o ícone respirar dentro da pílula arredondada.
    width: theme.spacing(8),
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing(9),
    },
  },
  // Acompanha a altura da barra fixa; se divergir, o topo do conteúdo fica
  // escondido atrás dela.
  appBarSpacer: {
    minHeight: "48px",
  },
  content: {
    flex: 1,
    overflow: "auto",
  },
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  paper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },
  iconButton: {
    color: theme.palette.text.primary,
  },
  // Contexto perigoso merece a cor cheia: quem é super operando dentro de uma
  // empresa precisa ver isso sem procurar.
  faixaSuper: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontSize: 12,
    padding: "4px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  botaoFaixaSuper: {
    color: "inherit",
    // currentColor, e não branco fixo: o texto sobre o azul é branco no modo
    // claro e quase-preto no escuro, e a borda tem que acompanhar.
    borderColor: "currentColor",
    opacity: 0.85,
    fontSize: 11,
    padding: "1px 8px",
    minHeight: 0,
  },
}));

const LoggedInLayout = ({ children }) => {
  const classes = useStyles();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, handleLeaveCompany, loading, user } = useContext(AuthContext);
  const { name: brandName, logo: brandLogo } = useBranding();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");
  const { darkMode, toggleTheme } = useThemeContext();
  const theme = useTheme();
  const { pathname } = useLocation();

  /**
   * A largura era lida uma vez, no primeiro render, direto do DOM.
   *
   * Girar o tablet ou redimensionar a janela não mudava nada: a barra
   * continuava fixa ocupando um terço de uma tela de 500px, ou permanecia
   * "temporária" numa janela que já tinha voltado a ser larga. O media query
   * reavalia sozinho, que é o que se esperava desde o começo.
   */
  const telaPequena = useMediaQuery(theme.breakpoints.down("sm"));

  const isSuperInCompany = user?.profile === "super" && !!user?.companyId;

  useEffect(() => {
    setDrawerVariant(telaPequena ? "temporary" : "permanent");
    setDrawerOpen(!telaPequena);
  }, [telaPequena]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  const handleClickLeaveCompany = () => {
    handleCloseMenu();
    handleLeaveCompany();
  };

  const drawerClose = () => {
    if (telaPequena) {
      setDrawerOpen(false);
    }
  };

  if (loading) {
    return <BackdropLoading />;
  }

  return (
    <div className={classes.root}>
      <Drawer
        variant={drawerVariant}
        className={drawerOpen ? classes.drawerPaper : classes.drawerPaperClose}
        classes={{
          paper: clsx(
            classes.drawerPaper,
            !drawerOpen && classes.drawerPaperClose
          ),
        }}
        open={drawerOpen}
      >
        {/* Cabeçalho da lateral: identidade da empresa à esquerda, recolher à
            direita. Antes era só o botão solto, sem nada identificando o
            sistema dentro da barra. */}
        <div className={classes.toolbarIcon}>
          {drawerOpen && (
            <div className={classes.brandBox}>
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={brandName}
                  className={classes.brandLogo}
                />
              ) : (
                <div className={classes.brandInitial}>
                  {brandName.charAt(0).toUpperCase()}
                </div>
              )}
              <Typography noWrap variant="subtitle2" className={classes.brandName}>
                {brandName}
              </Typography>
            </div>
          )}
          <IconButton onClick={() => setDrawerOpen(!drawerOpen)} size="small">
            {drawerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </div>
        <Divider />
        <List component="nav" disablePadding>
          <MainListItems drawerClose={drawerClose} recolhida={!drawerOpen} />
        </List>
        <Divider />
      </Drawer>
      <UserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        userId={user?.id}
      />
      <AppBar
        position="absolute"
        className={clsx(classes.appBar, drawerOpen && classes.appBarShift)}
      >
        {/* Banner de contexto — visível apenas quando super está operando em empresa */}
        {isSuperInCompany && (
          <div className={classes.faixaSuper}>
            <span>
              🏢 Operando como <strong>Super Admin</strong> na empresa <strong>{user.companyName || `#${user.companyId}`}</strong>
            </span>
            <Button
              size="small"
              className={classes.botaoFaixaSuper}
              variant="outlined"
              onClick={handleClickLeaveCompany}
            >
              Trocar empresa
            </Button>
          </div>
        )}
        <Toolbar variant="dense" className={classes.toolbar}>
          <IconButton
            edge="start"
            aria-label="open drawer"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={clsx(
              classes.menuButton,
              drawerOpen && classes.menuButtonHidden
            )}
            size="large">
            <MenuIcon />
          </IconButton>
          <Typography
            component="h1"
            variant="h6"
            noWrap
            className={classes.title}
          >
            {tituloDaRota(pathname) || brandName}
          </Typography>

          {/* Um botão que mostra para onde vai, em vez de um interruptor que
              mostra onde está: com dois modos só, é a leitura mais direta —
              e ocupa metade do espaço na barra. */}
          <Tooltip title={darkMode ? "Modo claro" : "Modo escuro"} arrow>
            <IconButton
              onClick={toggleTheme}
              className={classes.iconButton}
              aria-label={darkMode ? "Usar modo claro" : "Usar modo escuro"}
              size="large"
            >
              {darkMode ? (
                <LightModeIcon fontSize="small" />
              ) : (
                <DarkModeIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          {user.id && (
            <NotificationsPopOver className={classes.iconButton} />
          )}

          <div>
            <IconButton
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              className={classes.iconButton}
              size="large">
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={menuOpen}
              onClose={handleCloseMenu}
            >
              <div className={classes.identidade}>
                <Typography variant="body2" noWrap className={classes.nomeUsuario}>
                  {user?.name}
                </Typography>
                <Typography variant="caption" noWrap component="div" className={classes.emailUsuario}>
                  {user?.email}
                </Typography>
              </div>
              <Divider />
              <MenuItem onClick={handleOpenUserModal}>
                <ListItemText primary={i18n.t("mainDrawer.appBar.user.profile")} />
              </MenuItem>
              {isSuperInCompany && (
                <MenuItem onClick={handleClickLeaveCompany}>
                  Trocar empresa
                </MenuItem>
              )}
              <MenuItem onClick={handleClickLogout}>
                {i18n.t("mainDrawer.appBar.user.logout")}
              </MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      <main className={classes.content}>
        <div className={classes.appBarSpacer} />
        {children ? children : null}
      </main>
    </div>
  );
};

export default LoggedInLayout;
