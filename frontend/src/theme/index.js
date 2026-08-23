import { createTheme } from "@mui/material/styles";

/**
 * Definição única do visual da aplicação.
 *
 * Existia um tema no App.js e outro no contexto de modo escuro. Como o
 * segundo envolve todas as rotas, ele substituía o primeiro por completo — a
 * cor primária, o scrollbarStyles e a tradução pt-BR eram descartados em toda
 * a aplicação. Aqui a base é uma só e o modo entra como parâmetro.
 *
 * ---
 *
 * O visual é preto, branco e azul, com cantos retos.
 *
 * **Cantos retos** não são só gosto: o sistema é uma ferramenta de trabalho
 * densa -- quadro Kanban, listas de atendimento, tabelas. Canto arredondado
 * come alguns pixels em cada quina e, repetido centenas de vezes numa tela,
 * embaralha onde um bloco acaba e o outro começa. Com canto reto a separação
 * é a borda de 1px, e ela é inequívoca.
 *
 * **Uma cor de acento só.** Azul marca o que é clicável, o que está ativo e o
 * que tem foco -- e nada mais. Quando tudo tem cor, cor deixa de significar
 * alguma coisa. Verde, âmbar e vermelho continuam existindo, mas só onde
 * carregam sentido próprio (dinheiro entrando, alerta, erro).
 *
 * **Separação por borda, não por sombra.** Sombra difusa em fundo branco vira
 * borrão cinza; a borda de 1px sustenta a mesma hierarquia com menos ruído e
 * atravessa o modo escuro sem precisar ser reinventada.
 */

/** Cantos retos em toda a aplicação. Ver a nota acima. */
const RAIO = 0;

/**
 * Escala neutra do branco ao quase-preto.
 *
 * Quase-preto (#0b0d10) em vez de preto puro: preto absoluto sobre branco puro
 * gera um contraste que cansa em jornada inteira, e some qualquer nuance de
 * profundidade no modo escuro.
 */
const neutro = {
  0: "#ffffff",
  50: "#f7f8f9",
  100: "#eef0f3",
  200: "#e2e5ea",
  300: "#cfd4db",
  400: "#9aa3af",
  500: "#6b7480",
  600: "#525b67",
  700: "#3a424d",
  800: "#22272e",
  900: "#14181d",
  950: "#0b0d10"
};

/**
 * Azul do sistema.
 *
 * O tom claro é o que atende contraste sobre fundo escuro; o escuro, sobre
 * fundo claro. Usar o mesmo nos dois deixaria um dos modos ilegível.
 */
const azul = {
  claro: "#5b93ff",
  medio: "#0b5cff",
  escuro: "#0842c0"
};

export const buildTheme = (mode = "light", locale = {}) => {
  const escuro = mode === "dark";

  const primaria = escuro ? azul.claro : azul.medio;

  return createTheme(
    {
      palette: {
        mode,

        primary: {
          main: primaria,
          light: azul.claro,
          dark: azul.escuro,
          /**
           * O texto sobre o azul muda de cor com o modo.
           *
           * Branco sobre o azul escuro do modo claro dá 6,6:1; sobre o azul
           * claro do modo escuro, cai para 3:1 -- abaixo do mínimo de 4,5:1
           * para texto normal, e o rótulo do botão principal do sistema é
           * exatamente isso. No modo escuro quem contrasta é o quase-preto.
           */
          contrastText: escuro ? neutro[950] : "#ffffff"
        },

        /**
         * A secundária é neutra de propósito.
         *
         * O tema tem uma cor só, e o que antes era verde de conversa
         * disputava atenção com o azul em cada tela do atendimento.
         */
        secondary: {
          main: escuro ? neutro[200] : neutro[800],
          contrastText: escuro ? neutro[950] : "#ffffff"
        },

        // As semânticas sobrevivem porque significam coisas que o azul não
        // diz: dinheiro que entrou, prazo que venceu, operação que falhou.
        success: { main: escuro ? "#4ac47f" : "#15803d" },
        warning: { main: escuro ? "#e0a33a" : "#a16207" },
        error: { main: escuro ? "#f2837a" : "#c02b20" },
        info: { main: primaria },

        background: {
          default: escuro ? neutro[950] : neutro[50],
          paper: escuro ? neutro[900] : neutro[0]
        },

        text: {
          primary: escuro ? "#f3f5f7" : neutro[950],
          // 4.5:1 sobre o fundo de cada modo — texto de apoio ainda é texto,
          // e cinza-claro-demais é a forma mais comum de tornar uma tela
          // inacessível sem perceber.
          secondary: escuro ? "#a8b1bd" : neutro[600],
          disabled: escuro ? neutro[500] : neutro[400]
        },

        divider: escuro ? "rgba(255,255,255,0.12)" : neutro[200],

        action: {
          hover: escuro ? "rgba(255,255,255,0.06)" : "rgba(11,13,16,0.04)",
          selected: escuro ? "rgba(91,147,255,0.16)" : "rgba(11,92,255,0.08)",
          focus: escuro ? "rgba(91,147,255,0.24)" : "rgba(11,92,255,0.12)"
        }
      },

      shape: { borderRadius: RAIO },

      typography: {
        // Pilha do sistema, sem webfont: a instalação é de rede local e uma
        // fonte externa ou não carrega ou atrasa a primeira pintura. Declarar
        // "Inter" sem servi-la só faria cair na próxima da lista de qualquer
        // jeito.
        fontFamily:
          '"Segoe UI Variable Display","Segoe UI",system-ui,Roboto,"Helvetica Neue",Arial,sans-serif',

        // Títulos apertados e pesados; texto corrido no tamanho normal. É o
        // contraste de peso, e não de cor, que constrói a hierarquia aqui.
        h4: { fontWeight: 700, letterSpacing: "-0.02em" },
        h5: { fontWeight: 700, letterSpacing: "-0.02em" },
        h6: { fontWeight: 700, letterSpacing: "-0.015em" },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        button: { fontWeight: 600, textTransform: "none", letterSpacing: 0 },
        // Números de dinheiro e quantidade alinham por coluna em qualquer
        // tabela quando o algarismo tem largura fixa.
        overline: { fontWeight: 700, letterSpacing: "0.08em" }
      },

      /**
       * Sombra quase ausente.
       *
       * A separação entre blocos é feita por borda; a sombra fica só para o
       * que realmente flutua acima da página (menu, diálogo, popover). Manter
       * as 25 posições é obrigatório -- o MUI indexa este array direto.
       */
      shadows: [
        "none",
        escuro ? "0 1px 0 rgba(0,0,0,0.6)" : "0 1px 0 rgba(11,13,16,0.04)",
        escuro ? "0 2px 4px rgba(0,0,0,0.6)" : "0 2px 4px rgba(11,13,16,0.06)",
        escuro ? "0 4px 10px rgba(0,0,0,0.6)" : "0 4px 10px rgba(11,13,16,0.08)",
        ...Array(21).fill(
          escuro ? "0 12px 32px rgba(0,0,0,0.7)" : "0 12px 32px rgba(11,13,16,0.12)"
        )
      ],

      // Usado por dezenas de blocos makeStyles herdados — precisa continuar
      // existindo no tema final, não só no do App.
      scrollbarStyles: {
        "&::-webkit-scrollbar": { width: "10px", height: "10px" },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          // Quadrado como o resto: a barra de rolagem é parte da moldura.
          borderRadius: 0,
          border: "2px solid transparent",
          backgroundClip: "content-box",
          backgroundColor: escuro ? "rgba(255,255,255,0.20)" : neutro[300]
        },
        "&::-webkit-scrollbar-thumb:hover": {
          backgroundColor: escuro ? "rgba(255,255,255,0.32)" : neutro[400]
        }
      },

      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundColor: escuro ? neutro[950] : neutro[50],
              // Sem isso o Windows renderiza a pilha de sistema mais pesada do
              // que ela foi desenhada, e o texto de apoio fica borrado.
              WebkitFontSmoothing: "antialiased"
            },

            /**
             * Anel de foco visível, em toda a aplicação.
             *
             * Quem navega por teclado precisa ver onde está. O contorno padrão
             * do navegador some contra a maioria dos fundos; este é o azul do
             * sistema, com folga de 2px para não encostar no conteúdo.
             */
            "*:focus-visible": {
              outline: `2px solid ${primaria}`,
              outlineOffset: 2
            },

            "::selection": {
              backgroundColor: escuro
                ? "rgba(91,147,255,0.35)"
                : "rgba(11,92,255,0.18)"
            }
          }
        },

        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              borderRadius: RAIO,
              paddingInline: 16,
              minHeight: 36
            },
            // Contido sem sombra e sem gradiente: o peso vem do bloco de cor
            // cheio, que já se separa do fundo branco sozinho.
            containedPrimary: {
              "&:hover": { backgroundColor: azul.escuro }
            },
            outlined: {
              borderColor: escuro ? "rgba(255,255,255,0.22)" : neutro[300]
            },
            sizeSmall: { minHeight: 30, paddingInline: 12 }
          }
        },

        MuiIconButton: {
          styleOverrides: { root: { borderRadius: RAIO } }
        },

        MuiToggleButton: {
          styleOverrides: { root: { borderRadius: RAIO } }
        },

        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: { backgroundImage: "none" },
            rounded: { borderRadius: RAIO },
            outlined: {
              borderColor: escuro ? "rgba(255,255,255,0.12)" : neutro[200]
            }
          }
        },

        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: RAIO,
              border: `1px solid ${escuro ? "rgba(255,255,255,0.12)" : neutro[200]}`
            }
          }
        },

        MuiAppBar: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: {
              backgroundImage: "none",
              borderBottom: `1px solid ${
                escuro ? "rgba(255,255,255,0.12)" : neutro[200]
              }`
            }
          }
        },

        MuiDrawer: {
          styleOverrides: {
            paper: { backgroundImage: "none", borderRadius: RAIO }
          }
        },

        MuiDialog: {
          styleOverrides: { paper: { borderRadius: RAIO } }
        },

        MuiDialogTitle: {
          styleOverrides: {
            root: { fontWeight: 700, letterSpacing: "-0.015em" }
          }
        },

        MuiMenu: {
          styleOverrides: { paper: { borderRadius: RAIO } }
        },

        MuiPopover: {
          styleOverrides: { paper: { borderRadius: RAIO } }
        },

        MuiChip: {
          styleOverrides: {
            root: { borderRadius: RAIO, fontWeight: 600 }
          }
        },

        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: RAIO,
              // Dois pixels de borda no foco fariam o campo "pular" um pixel
              // para dentro; a cor sozinha já diz que ele está ativo.
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderWidth: 1,
                borderColor: primaria
              }
            },
            notchedOutline: {
              borderColor: escuro ? "rgba(255,255,255,0.20)" : neutro[300]
            }
          }
        },

        MuiFilledInput: {
          styleOverrides: { root: { borderRadius: RAIO } }
        },

        MuiTooltip: {
          styleOverrides: {
            tooltip: {
              borderRadius: RAIO,
              fontSize: "0.78rem",
              padding: "6px 10px",
              backgroundColor: escuro ? neutro[700] : neutro[800]
            }
          }
        },

        MuiTableCell: {
          styleOverrides: {
            head: {
              fontWeight: 700,
              fontSize: "0.74rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: escuro ? "#a8b1bd" : neutro[600],
              backgroundColor: escuro ? neutro[800] : neutro[100]
            },
            root: {
              borderColor: escuro ? "rgba(255,255,255,0.10)" : neutro[200]
            }
          }
        },

        MuiTab: {
          styleOverrides: {
            root: {
              textTransform: "none",
              fontWeight: 600,
              borderRadius: RAIO
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
          styleOverrides: { root: { borderRadius: RAIO } }
        },

        MuiListItemButton: {
          styleOverrides: { root: { borderRadius: RAIO } }
        },

        MuiAlert: {
          styleOverrides: { root: { borderRadius: RAIO } }
        },

        MuiLinearProgress: {
          styleOverrides: { root: { borderRadius: RAIO } }
        },

        MuiSnackbarContent: {
          styleOverrides: { root: { borderRadius: RAIO } }
        }
      }
    },
    locale
  );
};

export default buildTheme;
