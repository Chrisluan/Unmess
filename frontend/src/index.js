import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

// React 18 substitui ReactDOM.render por createRoot. StrictMode segue fora:
// ele monta os componentes duas vezes em desenvolvimento, e o @mui/styles
// (que sustenta os blocos makeStyles herdados) não é compatível com isso.
//
// O CssBaseline vive dentro do ThemeProvider (contexto de modo claro/escuro).
// Aqui fora ele aplicaria o tema padrão do MUI em vez do nosso.
const root = createRoot(document.getElementById("root"));

root.render(<App />);
