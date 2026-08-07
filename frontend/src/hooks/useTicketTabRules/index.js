import { useEffect, useState } from "react";

import api from "../../services/api";

// A definição das abas é estática e várias listas montam ao mesmo tempo.
// A promessa é guardada no módulo para todas compartilharem uma única
// requisição, em vez de uma por lista.
let cache = null;

const fetchRules = () => {
  if (!cache) {
    cache = api
      .get("/tickets/tab-rules")
      .then(({ data }) => data)
      .catch(err => {
        // Não fixa a falha no cache: a próxima montagem tenta de novo.
        cache = null;
        throw err;
      });
  }
  return cache;
};

/**
 * Regras das abas do painel, definidas no backend. Enquanto `loaded` for
 * falso o chamador não deve decidir nada sobre pertencimento de ticket — sem
 * a regra, aceitar ou rejeitar seria adivinhação.
 */
const useTicketTabRules = () => {
  const [rules, setRules] = useState(null);

  useEffect(() => {
    let ativo = true;

    fetchRules()
      .then(data => {
        if (ativo) setRules(data);
      })
      .catch(() => {
        if (ativo) setRules(null);
      });

    return () => {
      ativo = false;
    };
  }, []);

  return { rules, loaded: rules !== null };
};

export default useTicketTabRules;
