import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import api from "../../services/api";

/**
 * Fila de envio das mensagens que saem daqui.
 *
 * Antes o compositor esperava a resposta do servidor com a caixa de texto
 * desabilitada: enquanto o WhatsApp não confirmasse, o atendente não podia
 * digitar, nem trocar de conversa sem perder o envio. Numa conexão instável
 * isso travava a tela por vários segundos.
 *
 * Agora a mensagem entra aqui, aparece na conversa imediatamente como
 * "enviando" e o pedido segue por fora. Só a confirmação do WhatsApp promove
 * a mensagem a enviada; se falhar, ela continua na tela com a opção de tentar
 * de novo — em vez de sumir e deixar o atendente na dúvida se saiu ou não.
 *
 * A fila vive acima das telas de conversa justamente para sobreviver à troca
 * de ticket: sair da conversa não cancela o que já estava saindo.
 */
export const OutgoingMessagesContext = createContext({
  pendentes: [],
  enviar: () => {},
  reenviar: () => {},
  descartar: () => {},
});

const novoId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

// Depois de confirmada, a mensagem otimista some por conta própria. Ela já
// fica escondida assim que a versão real chega pelo socket; este prazo é só a
// rede de segurança para o caso de o socket não entregar nada.
const PRAZO_LIMPEZA_MS = 30000;

const montarFormData = ({ medias, caption, clientId }) => {
  const formData = new FormData();
  formData.append("fromMe", true);

  medias.forEach((media) => formData.append("medias", media));

  if (caption?.trim()) formData.append("caption", caption.trim());
  formData.append("clientId", clientId);

  return formData;
};

export const OutgoingMessagesProvider = ({ children }) => {
  const [pendentes, setPendentes] = useState([]);
  // Espelho da lista para quem precisa consultá-la fora do render — reenviar,
  // por exemplo. Ler de dentro do setState traria o risco de disparar o envio
  // duas vezes, porque o React pode chamar a função de atualização de novo.
  const listaRef = useRef([]);
  // Os temporizadores de limpeza, para poder cancelá-los se a mensagem for
  // descartada antes da hora.
  const relogios = useRef(new Map());

  useEffect(() => {
    listaRef.current = pendentes;
  }, [pendentes]);

  useEffect(
    () => () => {
      relogios.current.forEach((relogio) => clearTimeout(relogio));
      relogios.current.clear();

      listaRef.current.forEach((item) =>
        item.previas?.forEach((previa) => {
          if (previa.url) URL.revokeObjectURL(previa.url);
        })
      );
    },
    []
  );

  const atualizar = useCallback((id, mudancas) => {
    setPendentes((lista) =>
      lista.map((item) => (item.id === id ? { ...item, ...mudancas } : item))
    );
  }, []);

  const remover = useCallback((id) => {
    const relogio = relogios.current.get(id);
    if (relogio) {
      clearTimeout(relogio);
      relogios.current.delete(id);
    }

    setPendentes((lista) =>
      lista.filter((item) => {
        if (item.id !== id) return true;

        // As miniaturas do balão são URLs temporárias criadas para esta fila.
        // Sem devolvê-las ao navegador, o conteúdo de cada anexo enviado
        // ficaria preso na memória da aba até a próxima recarga.
        item.previas?.forEach((previa) => {
          if (previa.url) URL.revokeObjectURL(previa.url);
        });

        return false;
      })
    );
  }, []);

  const despachar = useCallback(
    async (item) => {
      atualizar(item.id, { status: "enviando", erro: null });

      try {
        // A mesma chave em toda tentativa: se a mensagem chegou a sair e só a
        // resposta se perdeu, o servidor devolve o resultado do primeiro
        // envio em vez de mandar de novo.
        const corpo = item.medias?.length
          ? montarFormData(item)
          : {
              read: 1,
              fromMe: true,
              mediaUrl: "",
              body: item.body,
              quotedMsg: item.quotedMsg,
              clientId: item.clientId,
            };

        const { data } = await api.post(`/messages/${item.ticketId}`, corpo);

        const idsReais = (data?.messages || [])
          .map((m) => m.id)
          .filter(Boolean);

        atualizar(item.id, { status: "enviada", idsReais });

        const relogio = setTimeout(() => remover(item.id), PRAZO_LIMPEZA_MS);
        relogios.current.set(item.id, relogio);
      } catch (err) {
        atualizar(item.id, {
          status: "falha",
          erro:
            err?.response?.data?.error || err?.message || "ERR_SENDING_WAPP_MSG",
        });
      }
    },
    [atualizar, remover]
  );

  /**
   * Coloca a mensagem na fila e devolve na hora. Quem chama não espera o
   * WhatsApp: a caixa de texto já pode ser limpa e usada de novo.
   */
  const enviar = useCallback(
    ({ ticketId, body, medias, caption, quotedMsg, previas }) => {
      const item = {
        id: `local-${novoId()}`,
        clientId: novoId(),
        ticketId: String(ticketId),
        body: body || caption || "",
        caption,
        medias: medias || [],
        previas: previas || [],
        quotedMsg: quotedMsg || null,
        status: "enviando",
        erro: null,
        idsReais: [],
        criadoEm: new Date().toISOString(),
      };

      setPendentes((lista) => [...lista, item]);
      despachar(item);

      return item.id;
    },
    [despachar]
  );

  const reenviar = useCallback(
    (id) => {
      const item = listaRef.current.find((i) => i.id === id);
      if (item) despachar(item);
    },
    [despachar]
  );

  return (
    <OutgoingMessagesContext.Provider
      value={{ pendentes, enviar, reenviar, descartar: remover }}
    >
      {children}
    </OutgoingMessagesContext.Provider>
  );
};

export const useOutgoingMessages = () => useContext(OutgoingMessagesContext);

export default OutgoingMessagesContext;
