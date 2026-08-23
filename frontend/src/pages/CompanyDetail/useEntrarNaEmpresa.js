import { useCallback, useContext } from "react";
import { useHistory } from "react-router-dom";

import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

/**
 * Troca o contexto do super para dentro de uma empresa.
 *
 * É o que evita duplicar as telas de Usuários e Configurações no painel do
 * super: em vez de uma segunda cópia de cada formulário, o super entra na
 * empresa e usa exatamente as telas que o admin dela usa — as mesmas regras,
 * as mesmas validações, um código só.
 *
 * O destino é parâmetro porque o atalho nasce em lugares diferentes: da lista
 * de usuários faz sentido cair em /users, do cabeçalho faz sentido cair no
 * atendimento.
 */
const useEntrarNaEmpresa = () => {
  const history = useHistory();
  const { handleSelectCompany } = useContext(AuthContext);

  return useCallback(
    async (company, destino = "/") => {
      if (!company?.id) return;
      try {
        await handleSelectCompany(company.id);
        history.push(destino);
      } catch (err) {
        toastError(err);
      }
    },
    [handleSelectCompany, history]
  );
};

export default useEntrarNaEmpresa;
