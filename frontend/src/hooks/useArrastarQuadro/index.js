import { useEffect, useRef } from "react";

/**
 * Faz o quadro rolar na horizontal de dois jeitos que faltavam.
 *
 * O problema: com muitas colunas, as últimas ficam fora da tela e não havia
 * como chegar nelas. A barra de rolagem sozinha não resolve — some em telas
 * sensíveis ao toque, e durante o arraste de um card ela nem é alcançável, o
 * que deixava impossível mover um card para uma coluna que não estivesse
 * visível.
 *
 * 1. Arrastar o fundo: segurar em qualquer área vazia e puxar para o lado,
 *    como num mapa. Só pega o fundo — clicar num card continua arrastando o
 *    card, e clicar num campo continua digitando.
 *
 * 2. Rolagem automática ao arrastar um card: aproximar o ponteiro da borda faz
 *    o quadro andar sozinho, e a velocidade cresce conforme se chega mais
 *    perto. Sem isso, mover um card para a última coluna era impossível.
 *
 * 3. Roda do mouse na horizontal: girar a roda sobre o quadro rola para o
 *    lado, já que não há o que rolar na vertical no nível do quadro.
 */

// Distância da borda em que a rolagem automática começa a agir.
const ZONA_BORDA = 90;
const VELOCIDADE_MAXIMA = 18;

const useArrastarQuadro = (arrastandoCard = false) => {
  const refQuadro = useRef(null);
  const estadoPan = useRef({ ativo: false, xInicial: 0, scrollInicial: 0 });
  const animacao = useRef(null);
  const ponteiroX = useRef(null);

  // ---- 1. arrastar o fundo para navegar -----------------------------------

  useEffect(() => {
    const quadro = refQuadro.current;
    if (!quadro) return undefined;

    const comecar = evento => {
      // Só botão principal, e só quando o alvo é o próprio quadro: um clique
      // sobre um card pertence ao card.
      if (evento.button !== 0 || evento.target !== quadro) return;

      estadoPan.current = {
        ativo: true,
        xInicial: evento.clientX,
        scrollInicial: quadro.scrollLeft
      };
      quadro.style.cursor = "grabbing";
      quadro.style.userSelect = "none";
    };

    const mover = evento => {
      if (!estadoPan.current.ativo) return;
      const distancia = evento.clientX - estadoPan.current.xInicial;
      quadro.scrollLeft = estadoPan.current.scrollInicial - distancia;
    };

    const terminar = () => {
      if (!estadoPan.current.ativo) return;
      estadoPan.current.ativo = false;
      quadro.style.cursor = "";
      quadro.style.userSelect = "";
    };

    quadro.addEventListener("mousedown", comecar);
    // No documento, e não no quadro: soltar o botão fora dele também encerra.
    document.addEventListener("mousemove", mover);
    document.addEventListener("mouseup", terminar);

    return () => {
      quadro.removeEventListener("mousedown", comecar);
      document.removeEventListener("mousemove", mover);
      document.removeEventListener("mouseup", terminar);
    };
  }, []);

  // ---- 2. rolagem automática enquanto arrasta um card ----------------------

  useEffect(() => {
    const quadro = refQuadro.current;
    if (!quadro || !arrastandoCard) return undefined;

    const acompanhar = evento => {
      ponteiroX.current = evento.clientX;
    };

    const passo = () => {
      const x = ponteiroX.current;

      if (x !== null) {
        const area = quadro.getBoundingClientRect();
        const daEsquerda = x - area.left;
        const daDireita = area.right - x;

        // A velocidade cresce conforme o ponteiro se aproxima da borda: perto
        // do limite anda rápido, na entrada da zona anda devagar.
        if (daEsquerda < ZONA_BORDA && daEsquerda > -40) {
          const forca = (ZONA_BORDA - Math.max(daEsquerda, 0)) / ZONA_BORDA;
          quadro.scrollLeft -= VELOCIDADE_MAXIMA * forca;
        } else if (daDireita < ZONA_BORDA && daDireita > -40) {
          const forca = (ZONA_BORDA - Math.max(daDireita, 0)) / ZONA_BORDA;
          quadro.scrollLeft += VELOCIDADE_MAXIMA * forca;
        }
      }

      animacao.current = requestAnimationFrame(passo);
    };

    // dragover em vez de mousemove: durante um arraste HTML5 o navegador não
    // dispara mousemove.
    document.addEventListener("dragover", acompanhar);
    animacao.current = requestAnimationFrame(passo);

    return () => {
      document.removeEventListener("dragover", acompanhar);
      if (animacao.current) cancelAnimationFrame(animacao.current);
      ponteiroX.current = null;
    };
  }, [arrastandoCard]);

  // ---- 3. roda do mouse rola na horizontal ---------------------------------

  useEffect(() => {
    const quadro = refQuadro.current;
    if (!quadro) return undefined;

    const naRoda = evento => {
      // Shift já rola na horizontal por padrão; não atrapalhar quem usa isso.
      if (evento.shiftKey || evento.deltaY === 0) return;

      const podeRolar = quadro.scrollWidth > quadro.clientWidth;
      if (!podeRolar) return;

      evento.preventDefault();
      quadro.scrollLeft += evento.deltaY;
    };

    quadro.addEventListener("wheel", naRoda, { passive: false });
    return () => quadro.removeEventListener("wheel", naRoda);
  }, []);

  return refQuadro;
};

export default useArrastarQuadro;
