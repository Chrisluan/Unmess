import { createTheme } from "@mui/material/styles";

/**
 * Definição única do visual da aplicação.
 *
 * Existia um tema no App.js e outro no contexto de modo escuro. Como o
 * segundo envolve todas as rotas, ele substituía o primeiro por completo — a
 * cor primária, o scrollbarStyles e a tradução pt-BR eram descartados em toda
 * a aplicação. Aqui a base é uma só e o modo entra como parâmetro.
 */

const RAIO = 12;

const cinza = {
  50: "#f7f8fa",
  100: "#eef0f4",
  200: "#e2e6ec",
  300: "#cbd2dc",
  600: "#5b6675",
  800: "#2b333f",
  900: "#1c222b"
};

export const buildTheme = (mode = "light", locale = {}) => {
  const escuro = mode === "dark";

  return createTheme(
    {
      palette: {
        mode,
        primary: { main: "#2576d2", light: "#5b9ae8", dark: "#17539f" },
        secondary: { main: "#00a884" }, // verde de conversa, familiar ao WhatsApp
        success: { main: "#2e9e5b" },
        warning: { main: "#c77700" },
        error: { main: "#d64545" },
        background: {
          default: escuro ? cinza[900] : cinza[50],
          paper: escuro ? cinza[800] : "#ffffff"
        },
        divider: escuro ? "rgba(255,255,255,0.10)" : cinza[200]
      },

      shape: { borderRadius: RAIO },

      typography: {
        // Pilha do sistema, sem webfont: a instalação é de rede local e uma
        // fonte externa ou não carrega ou atrasa a primeira pintura. Declarar
        // "Inter" sem servi-la só faria cair na próxima da lista de qualquer
        // jeito.
        fontFamily:
          '"Segoe UI Variable Display","Segoe UI",system-ui,Roboto,"Helvetica Neue",Arial,sans-serif',
        h5: { fontWeight: 600, letterSpacing: -0.2 },
        h6: { fontWeight: 600, letterSpacing: -0.2 },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        button: { fontWeight: 600, textTransform: "none" }
      },

      // Sombras difusas em vez das duras do padrão: o cinza de fundo já separa
      // os blocos, então a sombra só precisa dar profundidade.
      shadows: [
        "none",
        escuro ? "0 1px 2px rgba(0,0,0,0.5)" : "0 1px 2px rgba(16,24,40,0.06)",
        escuro ? "0 2px 6px rgba(0,0,0,0.5)" : "0 2px 8px rgba(16,24,40,0.08)",
        escuro ? "0 4px 12px rgba(0,0,0,0.5)" : "0 4px 16px rgba(16,24,40,0.10)",
        ...Array(21).fill(
          escuro ? "0 8px 24px rgba(0,0,0,0.6)" : "0 8px 28px rgba(16,24,40,0.12)"
        )
      ],

      // Usado por dezenas de blocos makeStyles herdados — precisa continuar
      // existindo no tema final, não só no do App.
      scrollbarStyles: {
        "&::-webkit-scrollbar": { width: "8px", height: "8px" },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          borderRadius: 8,
          backgroundColor: escuro ? "rgba(255,255,255,0.18)" : cinza[300]
        },
        "&::-webkit-scrollbar-thumb:hover": {
          backgroundColor: escuro ? "rgba(255,255,255,0.28)" : cinza[600]
        }
      },

      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: { backgroundColor: escuro ? cinza[900] : cinza[50] }
          }
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: { borderRadius: 10, paddingInline: 16 },
            sizeSmall: { borderRadius: 8 }
          }
        },
        MuiPaper: {
          styleOverrides: {
            rounded: { borderRadius: RAIO },
            outlined: { borderColor: escuro ? "rgba(255,255,255,0.10)" : cinza[200] }
          }
        },
        MuiDialog: {
          styleOverrides: { paper: { borderRadius: 16 } }
        },
        MuiChip: {
          styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } }
        },
        MuiOutlinedInput: {
          styleOverrides: { root: { borderRadius: 10 } }
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: { borderRadius: 8, fontSize: "0.78rem", padding: "6px 10px" }
          }
        },
        MuiTableCell: {
          styleOverrides: {
            head: { fontWeight: 600, backgroundColor: escuro ? cinza[800] : cinza[100] },
            root: { borderColor: escuro ? "rgba(255,255,255,0.08)" : cinza[200] }
          }
        },
        MuiTab: {
          styleOverrides: { root: { textTransform: "none", fontWeight: 600 } }
        },
        MuiAvatar: {
          styleOverrides: { root: { borderRadius: 10 } }
        }
      }
    },
    locale
  );
};

export default buildTheme;
