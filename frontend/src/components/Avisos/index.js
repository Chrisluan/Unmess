import React from "react";
import { ToastContainer } from "react-toastify";
import GlobalStyles from "@mui/material/GlobalStyles";
import { useTheme } from "@mui/material/styles";

/**
 * Os avisos do sistema, no visual do próprio tema.
 *
 * O container padrão da biblioteca tinha cores e raio próprios, sem relação
 * com o resto da tela, e ficava no topo à direita, cobrindo justamente o
 * cabeçalho e os botões de ação. Aqui:
 *
 *  - cores, raio, sombra e fonte vêm do tema (claro e escuro);
 *  - o aviso nasce embaixo, à direita, onde não esconde a navegação — e
 *    centralizado e na largura toda no celular;
 *  - compacto, sem barra de progresso, no máximo três de uma vez, e some ao
 *    clicar.
 */
const Avisos = () => {
  const theme = useTheme();
  const c = theme.palette.unmess;

  return (
    <>
      <GlobalStyles
        styles={{
          ":root": {
            "--toastify-color-light": c.superficie,
            "--toastify-color-dark": c.superficie,
            "--toastify-text-color-light": c.texto,
            "--toastify-text-color-dark": c.texto,
            "--toastify-color-info": c.primaria,
            "--toastify-color-success": c.sucesso,
            "--toastify-color-warning": c.atencao,
            "--toastify-color-error": c.erro,
            "--toastify-font-family": theme.typography.fontFamily,
            "--toastify-toast-width": "340px",
            "--toastify-toast-min-height": "0px",
            "--toastify-z-index": 2000
          },
          ".Toastify__toast": {
            borderRadius: `${theme.shape.borderRadius}px`,
            border: `1px solid ${c.linha}`,
            boxShadow: c.sombraFlutuante,
            padding: "10px 12px",
            marginBottom: 8,
            fontSize: "0.875rem",
            lineHeight: 1.4,
            alignItems: "center"
          },
          ".Toastify__toast-body": { padding: 0, margin: 0, gap: 10 },
          ".Toastify__toast-icon": { width: 18, marginInlineEnd: 0 },
          ".Toastify__close-button": { color: c.textoApagado, opacity: 0.7 },
          [theme.breakpoints.down("sm")]: {
            ".Toastify__toast-container": {
              width: "calc(100vw - 24px) !important",
              left: "12px !important",
              right: "12px !important",
              bottom: "12px !important",
              transform: "none !important"
            }
          }
        }}
      />
      <ToastContainer
        position="bottom-right"
        autoClose={4000}
        limit={3}
        hideProgressBar
        closeOnClick
        pauseOnHover
        pauseOnFocusLoss={false}
        draggable={false}
        theme={theme.palette.mode === "dark" ? "dark" : "light"}
      />
    </>
  );
};

export default Avisos;
