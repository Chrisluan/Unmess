import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "react-toastify";

import { AuthContext } from "../Auth/AuthContext";
import openSocket from "../../services/socket-io";
import api from "../../services/api";
import * as audio from "../../services/radioAudio";

/**
 * Chat de equipe e rádio, vivos enquanto a pessoa estiver logada.
 *
 * Mora acima das telas, e não dentro da tela de Equipe, pelo mesmo motivo de
 * um rádio de verdade ficar preso no cinto e não na mesa: quem entrou no
 * canal de "Produção" continua ouvindo enquanto atende uma conversa ou move um
 * card no funil. Sair da tela não pode desligar o rádio.
 *
 * O mesmo vale para as não lidas: o número no menu precisa subir com a pessoa
 * em qualquer tela.
 */

const TeamChatContext = createContext(null);

export const useTeamChat = () => useContext(TeamChatContext);

const ler = (chave, padrao) => {
  try {
    const valor = localStorage.getItem(chave);
    return valor === null ? padrao : JSON.parse(valor);
  } catch {
    return padrao;
  }
};

const gravar = (chave, valor) => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // modo privado ou armazenamento cheio: a preferência vale só nesta aba
  }
};

/** Tecla de "aperte para falar". F8 não escreve nada e existe em todo teclado. */
export const TECLA_PADRAO = "F8";

export const nomeDaTecla = (codigo) => {
  if (!codigo) return "—";
  if (codigo.startsWith("Key")) return codigo.slice(3);
  if (codigo.startsWith("Digit")) return codigo.slice(5);
  const nomes = {
    Space: "Espaço",
    ControlLeft: "Ctrl esquerdo",
    ControlRight: "Ctrl direito",
    AltLeft: "Alt",
    AltRight: "AltGr",
    ShiftLeft: "Shift esquerdo",
    ShiftRight: "Shift direito",
    Backquote: "'",
    CapsLock: "Caps Lock",
    Insert: "Insert",
    Pause: "Pause",
    ScrollLock: "Scroll Lock",
  };
  return nomes[codigo] || codigo;
};

const RADIO_FORA = {
  channelId: null,
  estado: "fora", // fora | entrando | dentro
  podeFalar: false,
  avisoMicrofone: null,
  euFalando: false,
  muted: false,
  deaf: false,
};

const ehCampoDeTexto = (alvo) => {
  if (!alvo) return false;
  const tag = alvo.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || alvo.isContentEditable;
};

export const TeamChatProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const meuId = user?.id ? Number(user.id) : null;
  const empresa = user?.companyId || null;

  const [socket, setSocket] = useState(null);
  const [canais, setCanais] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [salas, setSalas] = useState({});
  const [radio, setRadio] = useState(RADIO_FORA);
  const [aviso, setAviso] = useState(null);

  const [volume, setVolumeState] = useState(() => ler("radio:volume", 1));
  const [efeitoRadio, setEfeitoState] = useState(() => ler("radio:efeito", true));
  const [teclaPtt, setTeclaState] = useState(() => ler("radio:tecla", TECLA_PADRAO));

  const socketRef = useRef(null);
  const radioRef = useRef(RADIO_FORA);
  const canalAbertoRef = useRef(null);
  const ouvintesRef = useRef(new Set());
  const salasRef = useRef({});
  const canaisRef = useRef([]);

  // Transmissão:
  //   null              livre
  //   "pedindo"         apertou, esperando o servidor dar a vez
  //   "pedindo-soltou"  soltou antes de a vez chegar
  //   "sim"             com a vez, falando
  //   "soltando"        soltou; o fim da fala ainda está saindo
  const transmissaoRef = useRef(null);
  const filaRef = useRef([]);
  const pararTimerRef = useRef(null);

  const atualizarRadio = useCallback((mudancas) => {
    setRadio((atual) => {
      const novo = typeof mudancas === "function" ? mudancas(atual) : { ...atual, ...mudancas };
      radioRef.current = novo;
      return novo;
    });
  }, []);

  useEffect(() => {
    canaisRef.current = canais;
  }, [canais]);

  // ── Preferências ──────────────────────────────────────────────────────────

  useEffect(() => {
    audio.definirVolume(volume);
    gravar("radio:volume", volume);
  }, [volume]);

  useEffect(() => {
    audio.definirEfeitoRadio(efeitoRadio);
    gravar("radio:efeito", efeitoRadio);
  }, [efeitoRadio]);

  useEffect(() => {
    gravar("radio:tecla", teclaPtt);
  }, [teclaPtt]);

  // ── Dados ─────────────────────────────────────────────────────────────────

  const carregarCanais = useCallback(async () => {
    try {
      const { data } = await api.get("/team-chat/channels");
      setCanais(Array.isArray(data) ? data : []);
    } catch {
      // Sem a lista o menu fica sem contador; a tela de Equipe mostra o erro.
    }
  }, []);

  const carregarPessoas = useCallback(async () => {
    try {
      const { data } = await api.get("/team-chat/people");
      setPessoas(Array.isArray(data) ? data : []);
    } catch {
      // idem
    }
  }, []);

  const assinar = useCallback((fn) => {
    ouvintesRef.current.add(fn);
    return () => ouvintesRef.current.delete(fn);
  }, []);

  const definirCanalAberto = useCallback((channelId) => {
    canalAbertoRef.current = channelId ? Number(channelId) : null;
  }, []);

  const marcarComoLido = useCallback(async (channelId) => {
    const id = Number(channelId);
    setCanais((lista) => lista.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    try {
      await api.post(`/team-chat/channels/${id}/read`);
    } catch {
      // a próxima leitura tenta de novo
    }
  }, []);

  // ── Rádio: áudio de saída ─────────────────────────────────────────────────

  const enviarPacote = useCallback((pacote) => {
    const estado = transmissaoRef.current;
    if (estado === "pedindo" || estado === "pedindo-soltou") {
      // Enquanto o servidor não confirma a vez, a fala espera aqui — não se
      // perde o começo da frase dita junto com o aperto do botão.
      if (filaRef.current.length < 25) filaRef.current.push(pacote);
      return;
    }
    if (estado === "sim" || estado === "soltando") {
      socketRef.current?.emit("radio:audio", pacote);
    }
  }, []);

  const encerrarLocalmente = useCallback(() => {
    clearTimeout(pararTimerRef.current);
    pararTimerRef.current = null;
    audio.desligarTransmissao();
    transmissaoRef.current = null;
    filaRef.current = [];
    atualizarRadio({ euFalando: false });
  }, [atualizarRadio]);

  const pttDown = useCallback(() => {
    const r = radioRef.current;
    const s = socketRef.current;
    if (!s || r.estado !== "dentro") return;
    if (!r.podeFalar) {
      setAviso(r.avisoMicrofone || "Sem microfone: você está só na escuta.");
      return;
    }
    if (r.muted) {
      setAviso("Seu microfone está desligado neste canal.");
      return;
    }

    // Apertou de novo antes de o "soltar" anterior chegar ao servidor: a vez
    // ainda é nossa, basta continuar.
    if (pararTimerRef.current) {
      clearTimeout(pararTimerRef.current);
      pararTimerRef.current = null;
      transmissaoRef.current = "sim";
      audio.ligarTransmissao();
      atualizarRadio({ euFalando: true });
      return;
    }
    if (transmissaoRef.current === "pedindo-soltou") {
      transmissaoRef.current = "pedindo";
      audio.ligarTransmissao();
      return;
    }
    if (transmissaoRef.current) return;

    transmissaoRef.current = "pedindo";
    filaRef.current = [];
    audio.ligarTransmissao();
    setAviso(null);

    s.emit("radio:ptt:start", (resposta) => {
      const estado = transmissaoRef.current;
      if (!resposta?.ok) {
        audio.desligarTransmissao();
        transmissaoRef.current = null;
        filaRef.current = [];
        if (resposta?.erro === "ocupado") {
          audio.sons.ocupado();
          setAviso(`Canal ocupado: ${resposta.por || "alguém"} está falando.`);
        }
        return;
      }

      const pendentes = filaRef.current;
      filaRef.current = [];
      pendentes.forEach((p) => s.emit("radio:audio", p));

      if (estado === "pedindo-soltou") {
        // Soltou antes da confirmação: manda o que gravou e devolve a vez.
        transmissaoRef.current = "soltando";
        pararTimerRef.current = setTimeout(() => {
          pararTimerRef.current = null;
          transmissaoRef.current = null;
          s.emit("radio:ptt:stop");
        }, 80);
        return;
      }
      if (estado !== "pedindo") return;
      transmissaoRef.current = "sim";
      audio.sons.transmitir();
      atualizarRadio({ euFalando: true });
    });
  }, [atualizarRadio]);

  const pttUp = useCallback(() => {
    const estado = transmissaoRef.current;
    if (estado !== "pedindo" && estado !== "sim") return;

    // O worklet ainda entrega o último pedaço depois do "desligar"; o aviso
    // ao servidor espera esse pedaço passar, senão o fim da frase se perde.
    audio.desligarTransmissao();
    atualizarRadio({ euFalando: false });

    if (estado === "pedindo") {
      transmissaoRef.current = "pedindo-soltou";
      return;
    }

    transmissaoRef.current = "soltando";
    pararTimerRef.current = setTimeout(() => {
      pararTimerRef.current = null;
      transmissaoRef.current = null;
      socketRef.current?.emit("radio:ptt:stop");
    }, 80);
  }, [atualizarRadio]);

  // ── Rádio: entrar e sair ──────────────────────────────────────────────────

  const sairDoRadio = useCallback(() => {
    encerrarLocalmente();
    socketRef.current?.emit("radio:leave");
    audio.fecharMicrofone();
    atualizarRadio(RADIO_FORA);
    setAviso(null);
  }, [atualizarRadio, encerrarLocalmente]);

  const entrarNoRadio = useCallback(
    async (channelId) => {
      const id = Number(channelId);
      const s = socketRef.current;
      if (!s || !id) return;
      if (radioRef.current.channelId === id && radioRef.current.estado !== "fora") return;

      encerrarLocalmente();
      atualizarRadio({ ...RADIO_FORA, channelId: id, estado: "entrando" });

      try {
        await audio.prepararAudio();
        audio.definirVolume(volume);
        audio.definirEfeitoRadio(efeitoRadio);
      } catch {
        atualizarRadio(RADIO_FORA);
        toast.error("Este navegador não toca áudio em tempo real.");
        return;
      }

      let podeFalar = false;
      let avisoMicrofone = null;
      if (!audio.podeFalarAqui()) {
        avisoMicrofone =
          "O navegador só libera o microfone em endereço seguro (https). Por aqui você ouve, mas não fala.";
      } else {
        try {
          await audio.abrirMicrofone(enviarPacote);
          podeFalar = true;
        } catch (err) {
          avisoMicrofone =
            err?.name === "NotAllowedError"
              ? "O microfone foi bloqueado. Libere no cadeado da barra de endereço para falar."
              : err?.name === "NotFoundError"
              ? "Nenhum microfone encontrado. Você está só na escuta."
              : "Não foi possível abrir o microfone. Você está só na escuta.";
        }
      }

      // Pode ter clicado em outro canal enquanto o microfone abria.
      if (radioRef.current.channelId !== id) return;

      s.emit("radio:join", id, (resposta) => {
        if (radioRef.current.channelId !== id) return;
        if (!resposta?.ok) {
          audio.fecharMicrofone();
          atualizarRadio(RADIO_FORA);
          toast.error("Não foi possível entrar no rádio deste canal.");
          return;
        }
        atualizarRadio({ estado: "dentro", podeFalar, avisoMicrofone });
        if (resposta.sala) {
          salasRef.current = { ...salasRef.current, [id]: resposta.sala };
          setSalas(salasRef.current);
        }
        audio.sons.entrou();
      });
    },
    [atualizarRadio, encerrarLocalmente, enviarPacote, volume, efeitoRadio]
  );

  const definirMudo = useCallback(
    (muted) => {
      const r = radioRef.current;
      // Voltar a ouvir sem voltar a falar não existe no "surdo": quem tira o
      // fone tira o microfone junto, e quem liga o microfone liga o fone.
      const deaf = muted ? r.deaf : false;
      if (muted) pttUp();
      atualizarRadio({ muted, deaf });
      socketRef.current?.emit("radio:state", { muted, deaf });
    },
    [atualizarRadio, pttUp]
  );

  const definirSurdo = useCallback(
    (deaf) => {
      const r = radioRef.current;
      const muted = deaf ? true : r.muted;
      if (deaf) pttUp();
      atualizarRadio({ muted, deaf });
      socketRef.current?.emit("radio:state", { muted, deaf });
    },
    [atualizarRadio, pttUp]
  );

  // ── Socket ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!meuId || !empresa) return undefined;

    const s = openSocket();
    socketRef.current = s;
    setSocket(s);

    const aoConectar = () => {
      carregarCanais();
      carregarPessoas();
      s.emit("radio:rosters", (resposta) => {
        if (!resposta?.ok) return;
        const mapa = {};
        (resposta.salas || []).forEach((sala) => {
          mapa[sala.channelId] = sala;
        });
        salasRef.current = mapa;
        setSalas(mapa);
      });

      // O servidor esquece quem estava na escuta quando a conexão cai.
      // Voltando, a pessoa volta para o mesmo canal sem precisar clicar.
      const r = radioRef.current;
      if (r.channelId && r.estado === "dentro") {
        s.emit("radio:join", r.channelId, (resposta) => {
          if (!resposta?.ok) {
            audio.fecharMicrofone();
            atualizarRadio(RADIO_FORA);
            return;
          }
          if (r.muted || r.deaf) s.emit("radio:state", { muted: r.muted, deaf: r.deaf });
        });
      }
    };

    const aoMensagem = (evento) => {
      ouvintesRef.current.forEach((fn) => {
        try {
          fn(evento);
        } catch {
          // um ouvinte com defeito não derruba os outros
        }
      });

      const m = evento?.message;
      if (!m || evento.action !== "create") return;

      const conhecido = canaisRef.current.some((c) => c.id === m.channelId);
      if (!conhecido) {
        carregarCanais();
        return;
      }

      const deOutro = Number(m.userId) !== meuId;
      const aberto = canalAbertoRef.current === m.channelId && !document.hidden;
      setCanais((lista) =>
        lista.map((c) =>
          c.id === m.channelId
            ? {
                ...c,
                lastMessageId: m.id,
                lastMessageAt: m.createdAt,
                unread: deOutro && !aberto ? (c.unread || 0) + 1 : c.unread,
              }
            : c
        )
      );

      if (deOutro && !aberto) {
        const canal = canaisRef.current.find((c) => c.id === m.channelId);
        if (canal?.kind === "direct") audio.sons.mensagem();
      }
    };

    const aoCanal = () => carregarCanais();

    const aoLer = ({ channelId }) => {
      setCanais((lista) => lista.map((c) => (c.id === channelId ? { ...c, unread: 0 } : c)));
    };

    const aoPresenca = ({ userId, online }) => {
      setPessoas((lista) => lista.map((p) => (p.id === userId ? { ...p, online } : p)));
      setCanais((lista) =>
        lista.map((c) => (c.peer?.id === userId ? { ...c, peer: { ...c.peer, online } } : c))
      );
    };

    const aoRoster = (sala) => {
      const anterior = salasRef.current[sala.channelId];
      const meuCanal = radioRef.current.channelId === sala.channelId && radioRef.current.estado === "dentro";

      if (meuCanal && anterior) {
        const antes = new Set(anterior.membros.map((m) => m.userId));
        const depois = new Set(sala.membros.map((m) => m.userId));
        const entrou = [...depois].some((id) => !antes.has(id) && id !== meuId);
        const saiu = [...antes].some((id) => !depois.has(id) && id !== meuId);
        if (!radioRef.current.deaf) {
          if (entrou) audio.sons.entrou();
          else if (saiu) audio.sons.saiu();
        }
      }

      const mapa = { ...salasRef.current };
      if (sala.membros.length === 0) delete mapa[sala.channelId];
      else mapa[sala.channelId] = sala;
      salasRef.current = mapa;
      setSalas(mapa);
    };

    const aoPtt = ({ channelId, userId, falando }) => {
      if (radioRef.current.channelId !== channelId) return;
      if (Number(userId) === meuId) return;
      if (falando) {
        audio.reiniciarReproducao();
      } else if (!radioRef.current.deaf) {
        audio.sons.cambio();
      }
    };

    const aoAudio = ({ u, d }) => {
      if (Number(u) === meuId) return;
      if (radioRef.current.estado !== "dentro" || radioRef.current.deaf) return;
      audio.tocarPacote(d);
    };

    const aoTempoEsgotado = () => {
      encerrarLocalmente();
      audio.sons.tempoEsgotado();
      setAviso("Transmissão cortada: o limite é de 1 minuto por câmbio.");
    };

    const aoDerrubado = () => {
      encerrarLocalmente();
      audio.fecharMicrofone();
      atualizarRadio(RADIO_FORA);
      toast.info("Você entrou no rádio por outra aba ou aparelho; esta saiu do canal.");
    };

    const aoDesconectar = () => {
      // Sem conexão não há vez nem escuta; o "connect" seguinte reentra.
      encerrarLocalmente();
    };

    s.on("connect", aoConectar);
    s.on("disconnect", aoDesconectar);
    s.on("teamChat:message", aoMensagem);
    s.on("teamChat:channel", aoCanal);
    s.on("teamChat:read", aoLer);
    s.on("userPresence", aoPresenca);
    s.on("radio:roster", aoRoster);
    s.on("radio:ptt", aoPtt);
    s.on("radio:audio", aoAudio);
    s.on("radio:tot", aoTempoEsgotado);
    s.on("radio:kicked", aoDerrubado);

    return () => {
      encerrarLocalmente();
      audio.fecharMicrofone();
      radioRef.current = RADIO_FORA;
      setRadio(RADIO_FORA);
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [meuId, empresa, carregarCanais, carregarPessoas, atualizarRadio, encerrarLocalmente]);

  // ── Tecla de falar ────────────────────────────────────────────────────────

  useEffect(() => {
    if (radio.estado !== "dentro") return undefined;

    const apertou = (e) => {
      if (e.code !== teclaPtt || e.repeat) return;
      // Tecla que escreve, com o cursor num campo de texto, é para escrever.
      if (ehCampoDeTexto(e.target) && e.key && e.key.length === 1) return;
      e.preventDefault();
      pttDown();
    };
    const soltou = (e) => {
      if (e.code !== teclaPtt) return;
      pttUp();
    };
    // Trocar de janela com a tecla apertada não pode deixar o canal preso.
    const perdeuFoco = () => pttUp();
    const visibilidade = () => {
      if (document.hidden) pttUp();
    };

    window.addEventListener("keydown", apertou);
    window.addEventListener("keyup", soltou);
    window.addEventListener("blur", perdeuFoco);
    document.addEventListener("visibilitychange", visibilidade);
    return () => {
      window.removeEventListener("keydown", apertou);
      window.removeEventListener("keyup", soltou);
      window.removeEventListener("blur", perdeuFoco);
      document.removeEventListener("visibilitychange", visibilidade);
    };
  }, [radio.estado, teclaPtt, pttDown, pttUp]);

  // ── Valor ─────────────────────────────────────────────────────────────────

  const naoLidas = useMemo(
    () => canais.reduce((total, c) => total + (Number(c.unread) || 0), 0),
    [canais]
  );

  const salaAtual = radio.channelId ? salas[radio.channelId] : null;

  const valor = useMemo(
    () => ({
      socket,
      canais,
      pessoas,
      naoLidas,
      salas,
      radio,
      salaAtual,
      aviso,
      limparAviso: () => setAviso(null),
      carregarCanais,
      carregarPessoas,
      assinar,
      definirCanalAberto,
      marcarComoLido,
      entrarNoRadio,
      sairDoRadio,
      pttDown,
      pttUp,
      definirMudo,
      definirSurdo,
      volume,
      definirVolume: setVolumeState,
      efeitoRadio,
      definirEfeitoRadio: setEfeitoState,
      teclaPtt,
      definirTeclaPtt: setTeclaState,
    }),
    [
      socket,
      canais,
      pessoas,
      naoLidas,
      salas,
      radio,
      salaAtual,
      aviso,
      carregarCanais,
      carregarPessoas,
      assinar,
      definirCanalAberto,
      marcarComoLido,
      entrarNoRadio,
      sairDoRadio,
      pttDown,
      pttUp,
      definirMudo,
      definirSurdo,
      volume,
      efeitoRadio,
      teclaPtt,
    ]
  );

  return <TeamChatContext.Provider value={valor}>{children}</TeamChatContext.Provider>;
};

export default TeamChatContext;
