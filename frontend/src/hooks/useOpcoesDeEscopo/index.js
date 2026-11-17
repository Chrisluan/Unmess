import { useEffect, useMemo, useState } from "react";

import api from "../../services/api";
import usePermissions from "../usePermissions";

/**
 * As opções de cada dimensão de escopo: os quadros, as contas, as conexões.
 *
 * Cada dimensão declara no catálogo onde a sua lista mora (`fonte`) e em que
 * campo da resposta ela está (`campo`). Isso fica no servidor de propósito:
 * é o mesmo tipo de fato que a permissão exigida, muda quando o endpoint
 * muda, e uma tabelinha equivalente aqui no frontend seria a segunda cópia
 * que envelhece em silêncio — foi assim que o catálogo de permissões ficou
 * quatro módulos atrás do servidor.
 *
 * A lista vem filtrada pelo escopo de quem está pedindo, e isso é a regra
 * funcionando, não uma limitação: quem alcança dois quadros não pode conceder
 * um terceiro, e por isso não deve nem vê-lo na hora de montar o cargo. O
 * servidor recusaria de qualquer jeito — aqui a tela só não promete o que a
 * API vai negar.
 */
const useOpcoesDeEscopo = (listaDeEscopos, { ativo = true } = {}) => {
  const { can, isSuper } = usePermissions();

  const [opcoes, setOpcoes] = useState({});
  const [carregando, setCarregando] = useState(false);

  /**
   * As dimensões que esta pessoa pode configurar.
   *
   * Sem a permissão do módulo, buscar a lista devolveria 403 — e pedir para
   * alguém escolher quadros sem poder abrir o CRM é pedir um chute.
   */
  const disponiveis = useMemo(
    () =>
      (listaDeEscopos || []).filter(
        (escopo) => isSuper || can(escopo.requer)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listaDeEscopos, isSuper, can]
  );

  // A chave é o que decide recarregar: as fontes, e não o array, que muda de
  // identidade a cada render do componente que chama este hook.
  const assinatura = disponiveis.map((e) => e.chave).join(",");

  useEffect(() => {
    if (!ativo || disponiveis.length === 0) return undefined;

    let vivo = true;
    setCarregando(true);

    (async () => {
      const resultado = {};

      await Promise.all(
        disponiveis.map(async (escopo) => {
          try {
            const { data } = await api.get(escopo.fonte);
            const lista = escopo.campo ? data?.[escopo.campo] : data;
            resultado[escopo.chave] = Array.isArray(lista)
              ? lista.map((item) => ({
                  id: item.id,
                  nome: item.name || item.nome || `#${item.id}`,
                }))
              : [];
          } catch {
            // Uma fonte que falha vira dimensão sem opções, e não uma tela de
            // erro: as outras continuam configuráveis, e o que se perde é uma
            // seção, não o cargo inteiro.
            resultado[escopo.chave] = [];
          }
        })
      );

      if (vivo) {
        setOpcoes(resultado);
        setCarregando(false);
      }
    })();

    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, ativo]);

  return { opcoes, disponiveis, carregando };
};

export default useOpcoesDeEscopo;
