import React from "react";
import Routes from "./routes";
import "react-toastify/dist/ReactToastify.css";

/**
 * O tema é aplicado pelo ThemeProvider dentro de Routes (contexto de modo
 * claro/escuro), que é quem envolve a aplicação inteira. Definir outro tema
 * aqui não teria efeito nenhum — o de dentro prevalece.
 */
const App = () => <Routes />;

export default App;
