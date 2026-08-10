import React, { createContext, useState, useContext, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import { ThemeProvider as MUIThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { ptBR } from "@mui/material/locale";

import { buildTheme } from "../../theme";

const ThemeContext = createContext();
const CHAVE = "darkMode";

export const ThemeProvider = ({ children }) => {
  // A preferência sobrevive ao recarregamento: alternar o tema toda vez que
  // abre o sistema é atrito desnecessário.
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem(CHAVE) === "true"
  );

  useEffect(() => {
    localStorage.setItem(CHAVE, String(darkMode));
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((prevMode) => !prevMode);
  };

  // Mesma base visual do modo claro, só trocando o modo. Antes este provider
  // criava um tema do zero e apagava todo o restante da identidade.
  const theme = useMemo(
    () => buildTheme(darkMode ? "dark" : "light", ptBR),
    [darkMode]
  );

  const contextValue = useMemo(() => ({ darkMode, toggleTheme }), [darkMode]);

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
