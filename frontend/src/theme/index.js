import { createTheme, alpha } from "@mui/material/styles";

const claro = {
  fundo: "#F3F4F6",
  superficie: "#FCFCFD",
  superficie2: "#F7F8FA",
  hover: "#EEF0F3",
  linha: "#E3E6EA",
  linhaForte: "#D0D5DB",
  texto: "#1D2129",
  texto2: "#3D4450",
  textoApagado: "#646B76",
  primaria: "#5B45D6",
  primariaHover: "#4A35C2",
  primariaTexto: "#FFFFFF",
  primariaSuave: "#EEEBFC",
  primariaSuaveTexto: "#3F2DAE",
  sinal: "#12804A",
  sinalTexto: "#FFFFFF",
  sucesso: "#12804A",
  sucessoSuave: "#E3F4EA",
  atencao: "#8A5300",
  atencaoSuave: "#FDF1DC",
  erro: "#C0352B",
  erroSuave: "#FCE8E6",
  balaoRecebido: "#FFFFFF",
  balaoEnviado: "#E9E5FB",
  fundoConversa: "#EEF0F2",
  sombra: "0 1px 2px rgba(29,33,41,.06)",
  sombraFlutuante: "0 8px 28px rgba(29,33,41,.14)",
  foco: "0 0 0 3px rgba(91,69,214,.35)"
};

const escuro = {
  fundo: "#121418",
  superficie: "#1A1D23",
  superficie2: "#20242B",
  hover: "#272B33",
  linha: "#2C3139",
  linhaForte: "#3A404A",
  texto: "#E4E6EA",
  texto2: "#C4C8CF",
  textoApagado: "#9AA1AC",
  primaria: "#9D8CFF",
  primariaHover: "#B1A3FF",
  primariaTexto: "#121418",
  primariaSuave: "#2A2650",
  primariaSuaveTexto: "#CBC2FF",
  sinal: "#3CCB7F",
  sinalTexto: "#0B1A12",
  sucesso: "#5FD394",
  sucessoSuave: "#173024",
  atencao: "#F0B85A",
  atencaoSuave: "#33280F",
  erro: "#FF8A80",
  erroSuave: "#3A1D1B",
  balaoRecebido: "#20242B",
  balaoEnviado: "#2E2A55",
  fundoConversa: "#15181C",
  sombra: "0 1px 2px rgba(0,0,0,.3)",
  sombraFlutuante: "0 8px 28px rgba(0,0,0,.5)",
  foco: "0 0 0 3px rgba(157,140,255,.45)"
};

export const FONTE =
  '"Inter Variable","Inter",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';

export const buildTheme = (mode = "light", locale = {}, { textoGrande = false } = {}) => {
  const ehEscuro = mode === "dark";
  const c = ehEscuro ? escuro : claro;
  const raio = 12;

  return createTheme(
    {
      palette: {
        mode,
        primary: {
          main: c.primaria,
          dark: c.primariaHover,
          light: c.primariaSuave,
          contrastText: c.primariaTexto
        },
        secondary: { main: c.sinal, contrastText: c.sinalTexto },
        success: { main: c.sucesso, contrastText: c.sinalTexto },
        warning: { main: c.atencao },
        error: { main: c.erro },
        text: { primary: c.texto, secondary: c.textoApagado },
        background: { default: c.fundo, paper: c.superficie },
        divider: c.linha,
        action: {
          hover: c.hover,
          selected: c.primariaSuave,
          focus: c.hover
        },
        unmess: c
      },

      shape: { borderRadius: raio },

      typography: {
        fontFamily: FONTE,
        fontSize: textoGrande ? 16 : 14,
        h4: { fontWeight: 700, letterSpacing: "-0.015em" },
        h5: { fontWeight: 700, letterSpacing: "-0.015em" },
        h6: { fontWeight: 700, letterSpacing: "-0.01em" },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        body1: { lineHeight: 1.5 },
        body2: { lineHeight: 1.5 },
        button: { fontWeight: 600, textTransform: "none", letterSpacing: 0 }
      },

      shadows: ["none", c.sombra, c.sombra, c.sombra, ...Array(21).fill(c.sombraFlutuante)],

      scrollbarStyles: {
        "&::-webkit-scrollbar": { width: "10px", height: "10px" },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          borderRadius: 8,
          backgroundColor: c.linhaForte
        },
        "&::-webkit-scrollbar-thumb:hover": { backgroundColor: c.textoApagado }
      },

      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundColor: c.fundo,
              color: c.texto,
              fontFeatureSettings: '"cv11","tnum"',
              WebkitFontSmoothing: "antialiased"
            },
            "@media (prefers-reduced-motion: reduce)": {
              "*": { transition: "none !important", animation: "none !important" }
            }
          }
        },
        MuiButtonBase: {
          defaultProps: { disableRipple: true },
          styleOverrides: {
            root: {
              "&.Mui-focusVisible": { boxShadow: c.foco }
            }
          }
        },

        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              borderRadius: 10,
              minHeight: 40,
              paddingInline: 16,
              fontSize: "0.875rem",
              whiteSpace: "nowrap"
            },
            sizeSmall: { minHeight: 34, borderRadius: 10, paddingInline: 12, fontSize: "0.8125rem" },
            sizeLarge: { minHeight: 44, fontSize: "0.9375rem" },
            containedPrimary: {
              "&:hover": { backgroundColor: c.primariaHover }
            },
            outlined: {
              borderColor: c.linhaForte,
              backgroundColor: c.superficie,
              "&:hover": { backgroundColor: c.hover, borderColor: c.linhaForte }
            },
            outlinedInherit: { borderColor: c.linhaForte },
            text: {
              "&:hover": { backgroundColor: c.primariaSuave }
            },
            textPrimary: { color: c.primariaSuaveTexto }
          }
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              color: c.texto2,
              "&:hover": { backgroundColor: c.hover, color: c.texto }
            },
            sizeLarge: { padding: 8 }
          }
        },

        MuiIconButton: {
          styleOverrides: { root: { borderRadius: raio } }
        },

        MuiToggleButton: {
          styleOverrides: { root: { borderRadius: raio } }
        },

        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: { backgroundImage: "none" },
            rounded: { borderRadius: raio },
            outlined: { borderColor: c.linha }
          }
        },
        MuiCard: {
          defaultProps: { elevation: 0 },
          styleOverrides: { root: { border: `1px solid ${c.linha}` } }
        },
        /**
         * Base de todos os diálogos.
         *
         * Cada modal tinha o próprio respiro, a própria borda entre corpo e
         * rodapé e a própria ordem de botões. O que fica aqui vale até para os
         * que ainda não passaram para o componente Janela: mesmo raio, mesmo
         * espaçamento, botões alinhados à direita com o mesmo vão.
         */
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: 16,
              boxShadow: c.sombraFlutuante,
              border: `1px solid ${c.linha}`
            },
            paperFullScreen: { borderRadius: 0, border: "none" }
          }
        },
        MuiBackdrop: {
          styleOverrides: {
            root: {
              "&:not(.MuiBackdrop-invisible)": {
                backgroundColor: ehEscuro ? "rgba(0,0,0,.6)" : "rgba(29,33,41,.42)"
              }
            }
          }
        },
        MuiDialogTitle: {
          styleOverrides: {
            root: {
              fontWeight: 700,
              fontSize: "1.0625rem",
              letterSpacing: "-0.01em",
              padding: "18px 24px 10px"
            }
          }
        },
        MuiDialogContent: {
          styleOverrides: {
            root: { padding: "8px 24px 20px" },
            // A linha de baixo fica por conta do rodapé; as duas juntas
            // desenhavam um traço dobrado.
            dividers: { padding: "16px 24px", borderColor: c.linha, borderBottom: "none" }
          }
        },
        MuiDialogContentText: {
          styleOverrides: { root: { color: c.texto2, fontSize: "0.875rem" } }
        },
        MuiDialogActions: {
          styleOverrides: {
            root: {
              padding: "12px 20px",
              gap: 8,
              borderTop: `1px solid ${c.linha}`,
              backgroundColor: c.superficie2,
              "& > :not(style) ~ :not(style)": { marginLeft: 0 }
            }
          }
        },
        MuiPopover: {
          styleOverrides: {
            paper: {
              border: `1px solid ${c.linha}`,
              boxShadow: c.sombraFlutuante,
              borderRadius: raio
            }
          }
        },
        MuiMenu: {
          styleOverrides: {
            paper: { border: `1px solid ${c.linha}`, boxShadow: c.sombraFlutuante, borderRadius: raio },
            list: { padding: 6 }
          }
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              borderRadius: 8,
              minHeight: 40,
              "&.Mui-selected": { backgroundColor: c.primariaSuave, color: c.primariaSuaveTexto }
            }
          }
        },

        MuiChip: {
          styleOverrides: {
            root: { borderRadius: 999, fontWeight: 600 },
            filled: { backgroundColor: c.hover, color: c.texto2 }
          }
        },
        MuiBadge: {
          styleOverrides: {
            badge: { fontWeight: 700 },
            colorPrimary: { backgroundColor: c.sinal, color: c.sinalTexto }
          }
        },

        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              backgroundColor: c.superficie,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: c.linhaForte },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: c.textoApagado },
              "&.Mui-focused": { boxShadow: c.foco },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: c.primaria, borderWidth: 1 }
            }
          }
        },
        MuiInputLabel: {
          styleOverrides: { root: { "&.Mui-focused": { color: c.primariaSuaveTexto } } }
        },

        MuiFilledInput: {
          styleOverrides: { root: { borderRadius: raio } }
        },

        MuiTooltip: {
          defaultProps: { arrow: true },
          styleOverrides: {
            tooltip: {
              borderRadius: 8,
              fontSize: "0.8125rem",
              padding: "6px 10px",
              backgroundColor: ehEscuro ? "#E4E6EA" : "#1D2129",
              color: ehEscuro ? "#121418" : "#F3F4F6"
            },
            arrow: { color: ehEscuro ? "#E4E6EA" : "#1D2129" }
          }
        },

        MuiTableCell: {
          styleOverrides: {
            head: {
              fontWeight: 600,
              fontSize: "0.8125rem",
              color: c.textoApagado,
              backgroundColor: c.superficie
            },
            root: { borderColor: c.linha, paddingTop: 12, paddingBottom: 12 }
          }
        },
        MuiTableRow: {
          styleOverrides: {
            root: { "&.MuiTableRow-hover:hover": { backgroundColor: c.superficie2 } }
          }
        },
        MuiTabs: {
          styleOverrides: {
            indicator: { height: 3, borderRadius: "3px 3px 0 0" }
          }
        },

        MuiTab: {
          styleOverrides: {
            root: {
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.875rem",
              minHeight: 44,
              color: c.textoApagado,
              "&.Mui-selected": { color: c.primariaSuaveTexto }
            }
          }
        },
        MuiSwitch: {
          styleOverrides: {
            switchBase: {
              "&.Mui-checked": { color: c.primaria },
              "&.Mui-checked + .MuiSwitch-track": { backgroundColor: c.primaria }
            }
          }
        },

        MuiTabs: {
          styleOverrides: {
            // A faixa do indicador é o que marca a aba ativa; deixá-la fina
            // demais some no meio da borda de baixo.
            indicator: { height: 2 }
          }
        },

        MuiAvatar: {
          styleOverrides: {
            root: {
              backgroundColor: c.primariaSuave,
              color: c.primariaSuaveTexto,
              fontWeight: 600
            }
          }
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              "&.Mui-selected": { backgroundColor: c.primariaSuave },
              "&.Mui-selected:hover": { backgroundColor: alpha(c.primaria, ehEscuro ? 0.3 : 0.14) }
            }
          }
        },
        MuiDivider: {
          styleOverrides: { root: { borderColor: c.linha } }
        },
        MuiAlert: {
          styleOverrides: { root: { borderRadius: 12 } }
        }
      }
    },
    locale
  );
};

export default buildTheme;
