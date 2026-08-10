import React, { useState, useContext, useEffect } from "react";
import clsx from "clsx";
import {
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  MenuItem,
  IconButton,
  Menu,
  Switch,
  Button,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AccountCircle from "@mui/icons-material/AccountCircle";
import Brightness4Icon from "@mui/icons-material/Brightness4";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import { useBranding } from "../context/Branding";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import { useThemeContext } from "../context/DarkMode";

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
    padding: "0 8px",
    minHeight: "56px",
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
    borderRadius: 8,
    objectFit: "contain",
    flexShrink: 0,
  },

  // Sem logo, a inicial do nome dá alguma identidade em vez de espaço vazio.
  brandInitial: {
    width: 28,
    height: 28,
    borderRadius: 8,
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
    color: theme.palette.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    backgroundColor: theme.palette.background.default,
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
  switch: {
    transform: "scale(0.8)",
  },
  iconButton: {
    color: theme.palette.text.primary,
  },
  themeSwitchContainer: {
    display: "flex",
    alignItems: "center",
  },
  themeIcon: {
    color: theme.palette.text.primary,
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

  const isSuperInCompany = user?.profile === "super" && !!user?.companyId;

  useEffect(() => {
    if (document.body.offsetWidth > 600) {
      setDrawerOpen(true);
    }
  }, []);

  useEffect(() => {
    if (document.body.offsetWidth < 600) {
      setDrawerVariant("temporary");
    } else {
      setDrawerVariant("permanent");
    }
  }, [drawerOpen]);

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
    if (document.body.offsetWidth < 600) {
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
          <div style={{
            backgroundColor: "#1565c0",
            color: "#fff",
            fontSize: 12,
            padding: "3px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span>
              🏢 Operando como <strong>Super Admin</strong> na empresa <strong>{user.companyName || `#${user.companyId}`}</strong>
            </span>
            <Button
              size="small"
              style={{ color: "#fff", borderColor: "rgba(255,255,255,0.5)", fontSize: 11, padding: "1px 8px" }}
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
            {brandName}
          </Typography>

          <div className={classes.themeSwitchContainer}>
            <Brightness4Icon className={classes.themeIcon} />
            <Switch
              checked={darkMode}
              onChange={toggleTheme}
              color="default"
              className={classes.switch}
            />
          </div>

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
              getContentAnchorEl={null}
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
              <MenuItem onClick={handleOpenUserModal}>
                {i18n.t("mainDrawer.appBar.user.profile")}
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
