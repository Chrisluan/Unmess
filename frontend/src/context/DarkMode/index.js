import React, { createContext, useState, useContext, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import { ThemeProvider as MUIThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { ptBR } from "@mui/material/locale";

import { buildTheme } from "../../theme";

const ThemeContext = createContext();
const CHAVE_TEMA = "darkMode";
const CHAVE_TEXTO = "textoGrande";

const lerPreferencia = (chave, padrao) => {
  try {
    const valor = localStorage.getItem(chave);
    return valor === null ? padrao : valor === "true";
  } catch {
    return padrao;
  }
};

const gravarPreferencia = (chave, valor) => {
  try {
    localStorage.setItem(chave, String(valor));
    return true;
  } catch {
    return false;
  }
};

const sistemaEscuro = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => lerPreferencia(CHAVE_TEMA, sistemaEscuro()));
  const [textoGrande, setTextoGrande] = useState(() => lerPreferencia(CHAVE_TEXTO, false));

  useEffect(() => {
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((anterior) => {
      gravarPreferencia(CHAVE_TEMA, !anterior);
      return !anterior;
    });
  };

  const toggleTextoGrande = () => {
    setTextoGrande((anterior) => {
      gravarPreferencia(CHAVE_TEXTO, !anterior);
      return !anterior;
    });
  };

  const theme = useMemo(
    () => buildTheme(darkMode ? "dark" : "light", ptBR, { textoGrande }),
    [darkMode, textoGrande]
  );

  const contextValue = useMemo(
    () => ({ darkMode, toggleTheme, textoGrande, toggleTextoGrande }),
    [darkMode, textoGrande]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useThemeContext = () => useContext(ThemeContext);
