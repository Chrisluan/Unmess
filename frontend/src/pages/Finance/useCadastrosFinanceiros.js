import { useState, useEffect, useCallback } from "react";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const VAZIO = {
  paymentTerms: [],
  accounts: [],
  categories: [],
  suppliers: [],
};

/**
 * Contas, categorias, condições de pagamento e fornecedores.
 *
 * Os seletores de A receber, A pagar e Configuração dependem todos da mesma
 * lista. Enquanto o Financeiro era uma tela só com quatro abas, ela era
 * carregada uma vez lá em cima e distribuída por props; agora que cada módulo
 * tem rota própria, quem precisa pede.
 *
 * São três telas, uma requisição pequena, e trocar de módulo é raro dentro de
 * uma mesma sessão de trabalho — não vale um cache global, que traria consigo
 * a pergunta de quando invalidá-lo toda vez que alguém cadastrar uma conta.
 *
 * Devolve também `recarregar`, porque salvar um cadastro precisa fazer os
 * seletores enxergarem o que acabou de ser criado.
 */
const useCadastrosFinanceiros = () => {
  const [cadastros, setCadastros] = useState(VAZIO);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      const { data } = await api.get("/finance/cadastros");
      setCadastros(data || VAZIO);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { cadastros, recarregar, carregando };
};

export default useCadastrosFinanceiros;
