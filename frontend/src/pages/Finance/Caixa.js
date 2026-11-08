import React from "react";

import Shell from "./Shell";
import AbaCaixa from "./AbaCaixa";

/**
 * Fluxo de caixa — o dinheiro que se moveu, e o que ainda vai se mover.
 */
const Caixa = () => (
  <Shell
    titulo="Fluxo de caixa"
    descricao="Entradas e saídas do período, saldo por conta e o previsto que ainda vai cair."
  >
    <AbaCaixa />
  </Shell>
);

export default Caixa;
