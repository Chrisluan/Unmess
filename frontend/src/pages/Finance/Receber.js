import React from "react";

import Shell from "./Shell";
import AbaReceber from "./AbaReceber";
import useCadastrosFinanceiros from "./useCadastrosFinanceiros";

/**
 * Contas a receber — quem deve para a empresa.
 *
 * A tela já avisa sozinha quando existe venda faturada que ainda não virou
 * cobrança; era esse aviso que aparecia como selo na aba, quando o Financeiro
 * era uma tela só.
 */
const Receber = () => {
  const { cadastros } = useCadastrosFinanceiros();

  return (
    <Shell
      titulo="Contas a receber"
      descricao="Cobranças emitidas, o que já foi baixado e o que está vencido."
    >
      <AbaReceber cadastros={cadastros} />
    </Shell>
  );
};

export default Receber;
