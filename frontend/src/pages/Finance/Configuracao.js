import React from "react";

import Shell from "./Shell";
import AbaCadastros from "./AbaCadastros";
import useCadastrosFinanceiros from "./useCadastrosFinanceiros";

/**
 * Configuração financeira.
 *
 * Não foi para o módulo Cadastro junto com produtos e etiquetas de propósito:
 * conta bancária, categoria e condição de pagamento decidem como todo
 * lançamento futuro é classificado, e quem mexe nelas é quem cuida do
 * dinheiro — não quem cuida das listas do atendimento.
 */
const Configuracao = () => {
  const { cadastros, recarregar } = useCadastrosFinanceiros();

  return (
    <Shell
      titulo="Configuração financeira"
      descricao="Contas, categorias, condições de pagamento e fornecedores. Muda como todo lançamento futuro é classificado."
    >
      <AbaCadastros cadastros={cadastros} onSalvo={recarregar} />
    </Shell>
  );
};

export default Configuracao;
