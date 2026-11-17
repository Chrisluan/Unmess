import React, { useState, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Button,
  CssBaseline,
  TextField,
  Typography,
  InputAdornment,
  IconButton,
  Link,
  CircularProgress
} from "@mui/material";

import { Visibility, VisibilityOff } from "@mui/icons-material";

import makeStyles from "@mui/styles/makeStyles";

import { i18n } from "../../translate/i18n";

import { AuthContext } from "../../context/Auth/AuthContext";
import { useBranding } from "../../context/Branding";

const useStyles = makeStyles((theme) => ({
  /**
   * Tela inteira, com o cartão centrado.
   *
   * O formulário antigo ficava colado no topo de um contêiner estreito, sem
   * moldura: era a única tela do sistema em que nada dizia onde a página
   * começava. Aqui o bloco tem borda, e a borda é o que separa.
   */
  tela: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.default
  },

  cartao: {
    width: "100%",
    maxWidth: 380,
    padding: theme.spacing(4),
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`
  },

  marca: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: theme.spacing(3)
  },

  logo: {
    width: 36,
    height: 36,
    objectFit: "contain",
    flexShrink: 0
  },

  // Sem logo, a inicial sobre o azul dá alguma identidade em vez de um vazio.
  inicial: {
    width: 36,
    height: 36,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "1.05rem",
    color: theme.palette.primary.contrastText,
    backgroundColor: theme.palette.primary.main
  },

  nomeMarca: {
    fontWeight: 700,
    letterSpacing: "-0.02em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },

  titulo: {
    fontWeight: 700,
    letterSpacing: "-0.02em",
    marginBottom: theme.spacing(0.5)
  },

  apoio: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3)
  },

  entrar: {
    marginTop: theme.spacing(3),
    minHeight: 42
  },

  rodape: {
    marginTop: theme.spacing(3),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
    textAlign: "center"
  }
}));

const Login = () => {
  const classes = useStyles();
  const { name: nomeDaMarca, logo } = useBranding();

  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [entrando, setEntrando] = useState(false);

  const { handleLogin } = useContext(AuthContext);

  const handleChangeInput = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handlSubmit = async (e) => {
    e.preventDefault();
    setEntrando(true);
    try {
      await handleLogin(user);
    } finally {
      // Em caso de erro a tela continua aqui e o botão precisa voltar; no
      // sucesso o componente é desmontado antes disso importar.
      setEntrando(false);
    }
  };

  return (
    <div className={classes.tela}>
      <CssBaseline />

      <div className={classes.cartao}>
        <div className={classes.marca}>
          {logo ? (
            <img src={logo} alt={nomeDaMarca} className={classes.logo} />
          ) : (
            <div className={classes.inicial}>
              {nomeDaMarca.charAt(0).toUpperCase()}
            </div>
          )}
          <Typography variant="subtitle1" className={classes.nomeMarca}>
            {nomeDaMarca}
          </Typography>
        </div>

        <Typography component="h1" variant="h5" className={classes.titulo}>
          {i18n.t("login.title")}
        </Typography>
        <Typography variant="body2" className={classes.apoio}>
          {i18n.t("login.subtitle")}
        </Typography>

        <form noValidate onSubmit={handlSubmit}>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            id="email"
            label={i18n.t("login.form.email")}
            name="email"
            value={user.email}
            onChange={handleChangeInput}
            autoComplete="email"
            autoFocus
          />
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            name="password"
            label={i18n.t("login.form.password")}
            id="password"
            value={user.password}
            onChange={handleChangeInput}
            autoComplete="current-password"
            type={showPassword ? "text" : "password"}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={
                      showPassword ? "Ocultar a senha" : "Mostrar a senha"
                    }
                    onClick={() => setShowPassword((e) => !e)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            className={classes.entrar}
            disabled={entrando}
            startIcon={
              entrando ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {entrando
              ? i18n.t("login.buttons.submitting")
              : i18n.t("login.buttons.submit")}
          </Button>
        </form>

        <div className={classes.rodape}>
          <Link variant="body2" component={RouterLink} to="/signup">
            {i18n.t("login.buttons.register")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
