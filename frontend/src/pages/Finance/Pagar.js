import React from "react";

import Shell from "./Shell";
import AbaPagar from "./AbaPagar";
import useCadastrosFinanceiros from "./useCadastrosFinanceiros";

/**
 * Contas a pagar — o que a empresa deve.
 */
const Pagar = () => {
  const { cadastros, recarregar } = useCadastrosFinanceiros();

  return (
    <Shell
      titulo="Contas a pagar"
      descricao="Compromissos com fornecedores e despesas da operação, por vencimento."
    >
      <AbaPagar cadastros={cadastros} onSalvo={recarregar} />
    </Shell>
  );
};

export default Pagar;
