import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Recarrega a tela de tempos em tempos, por HTTP.
 *
 * Substitui o socket no quadro. O socket entrega mais rápido, mas depende de
 * uma conexão viva o tempo todo -- e pelo túnel, com a máquina em Wi-Fi, essa
 * conexão cai e volta sem avisar, deixando o quadro parado no passado sem
 * ninguém perceber. Uma requisição a cada N segundos é mais grosseira e sempre
 * chega ao mesmo lugar: o estado atual.
 *
 * A preferência fica no navegador de cada um. Quem trabalha o dia inteiro no
 * quadro quer atualização curta; quem só consulta prefere não gastar rede.
 */

const CHAVE = "crm:atualizacao-automatica";
const INTERVALO_PADRAO = 30;

const lerPreferencia = () => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE) || "null");
    if (guardado && typeof guardado === "object") {
      return {
        ligada: Boolean(guardado.ligada),
        intervalo: Number(guardado.intervalo) || INTERVALO_PADRAO
      };
    }
  } catch {
    // Preferência corrompida não impede o quadro de abrir.
  }
  return { ligada: false, intervalo: INTERVALO_PADRAO };
};

const useAtualizacaoAutomatica = (aoAtualizar) => {
  const [{ ligada, intervalo }, setPreferencia] = useState(lerPreferencia);
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  // A função de recarga muda a cada render do componente pai; guardá-la numa
  // ref evita reiniciar o cronômetro a cada troca e perder o ciclo em curso.
  const callback = useRef(aoAtualizar);
  useEffect(() => {
    callback.current = aoAtualizar;
  }, [aoAtualizar]);

  const salvar = useCallback((novo) => {
    setPreferencia(novo);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novo));
    } catch {
      // Sem localStorage a preferência vale só para esta sessão.
    }
  }, []);

  useEffect(() => {
    if (!ligada) return undefined;

    const disparar = async () => {
      // Aba escondida não precisa de dados novos: atualizar em segundo plano
      // gasta rede e bateria para uma tela que ninguém está vendo.
      if (document.visibilityState !== "visible") return;

      await callback.current?.();
      setAtualizadoEm(new Date());
    };

    const cronometro = setInterval(disparar, Math.max(5, intervalo) * 1000);

    // Ao voltar para a aba, atualiza na hora em vez de esperar o próximo ciclo
    // -- é justamente o momento em que os dados na tela estão mais velhos.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") disparar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      clearInterval(cronometro);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [ligada, intervalo]);

  return {
    ligada,
    intervalo,
    atualizadoEm,
    alternar: () => salvar({ ligada: !ligada, intervalo }),
    mudarIntervalo: (segundos) =>
      salvar({ ligada, intervalo: Math.max(5, Number(segundos) || INTERVALO_PADRAO) })
  };
};

export default useAtualizacaoAutomatica;
