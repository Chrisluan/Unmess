import React, { useState, useEffect, useMemo, useContext } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Collapse from "@mui/material/Collapse";
import CircularProgress from "@mui/material/CircularProgress";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import useWhatsApps from "../../hooks/useWhatsApps";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePermissions from "../../hooks/usePermissions";
import Janela, { SecaoDaJanela, OpcaoDaJanela } from "../Janela";

/**
 * Transferir conversa.
 *
 * O modal antigo tinha três campos soltos (atendente, setor, conexão) e dois
 * "X" que agiam na hora, sem confirmação. O resultado mudava conforme a
 * combinação preenchida, e só quem lia o código sabia qual seria. Ele também
 * buscava as pessoas em /users — exige "ver usuários", que quem só atende não
 * tem — e mantinha o setor atual marcado mesmo quando a pessoa escolhida não
 * fazia parte dele.
 *
 * Agora é uma pergunta por vez:
 *
 *   1. Para quem? Uma pessoa (a conversa vai direto para ela, já em
 *      atendimento) ou um setor (vai para a fila de espera, qualquer um do
 *      setor assume). Devolver para a fila é escolher o setor atual.
 *   2. O detalhe da escolha: a pessoa, e em qual dos setores dela; ou o setor.
 *   3. Um recado opcional, que vira nota interna.
 *
 * Embaixo, uma frase diz exatamente o que vai acontecer, e o botão repete o
 * destino ("Transferir para Ana").
 */

const useStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;
  return {
    modos: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      [theme.breakpoints.down("sm")]: { gridTemplateColumns: "1fr" },
    },

    lista: {
      border: `1px solid ${c.linha}`,
      borderRadius: 12,
      maxHeight: 264,
      overflowY: "auto",
      marginTop: 10,
      ...theme.scrollbarStyles,
    },

    item: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      padding: "10px 12px",
      border: "none",
      borderBottom: `1px solid ${c.linha}`,
      background: "transparent",
      color: c.texto,
      font: "inherit",
      textAlign: "left",
      cursor: "pointer",
      "&:last-child": { borderBottom: "none" },
      "&:hover": { background: c.superficie2 },
      "&:focus-visible": { outline: "none", boxShadow: `inset ${c.foco}` },
      "&:disabled": { cursor: "not-allowed", opacity: 0.5 },
    },

    itemMarcado: {
      background: c.primariaSuave,
      "&:hover": { background: c.primariaSuave },
    },

    avatar: {
      position: "relative",
      width: 34,
      height: 34,
      borderRadius: "50%",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "0.75rem",
      fontWeight: 700,
      background: c.hover,
      color: c.texto2,
    },

    presenca: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: 11,
      height: 11,
      borderRadius: "50%",
      border: `2px solid ${c.superficie}`,
    },

    pontoSetor: {
      width: 12,
      height: 12,
      borderRadius: 4,
      flexShrink: 0,
    },

    itemTextos: { flex: 1, minWidth: 0 },

    itemNome: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontWeight: 600,
      fontSize: "0.875rem",
      lineHeight: 1.3,
    },

    itemDetalhe: {
      fontSize: "0.75rem",
      color: c.textoApagado,
      marginTop: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },

    selo: {
      fontSize: "0.6875rem",
      fontWeight: 700,
      padding: "1px 6px",
      borderRadius: 999,
      background: c.hover,
      color: c.texto2,
      whiteSpace: "nowrap",
    },

    marca: { color: c.primaria, flexShrink: 0 },

    vazio: {
      padding: "20px 12px",
      textAlign: "center",
      fontSize: "0.8125rem",
      color: c.textoApagado,
    },

    carregando: { display: "flex", justifyContent: "center", padding: 28 },

    setoresDaPessoa: { display: "flex", flexWrap: "wrap", gap: 8 },

    chipSetor: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 12px",
      borderRadius: 999,
      border: `1px solid ${c.linhaForte}`,
      background: c.superficie,
      color: c.texto,
      font: "inherit",
      fontSize: "0.8125rem",
      fontWeight: 600,
      cursor: "pointer",
      "&:hover": { background: c.superficie2 },
      "&:focus-visible": { outline: "none", boxShadow: c.foco },
    },

    chipSetorMarcado: {
      borderColor: c.primaria,
      background: c.primariaSuave,
      color: c.primariaSuaveTexto,
      "&:hover": { background: c.primariaSuave },
    },

    resumo: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      padding: "12px 14px",
      borderRadius: 12,
      background: c.superficie2,
      border: `1px solid ${c.linha}`,
      fontSize: "0.8125rem",
      lineHeight: 1.5,
      color: c.texto2,
      "& strong": { color: c.texto },
      "& svg": { fontSize: 18, color: c.primaria, marginTop: 1 },
    },

    avancado: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: 0,
      border: "none",
      background: "none",
      font: "inherit",
      fontSize: "0.8125rem",
      fontWeight: 600,
      color: c.textoApagado,
      cursor: "pointer",
      "&:hover": { color: c.texto },
      "& svg": { fontSize: 18, transition: "transform 150ms" },
    },

    girado: { transform: "rotate(180deg)" },
  };
});

const iniciais = (nome) =>
  (nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("");

const semAcento = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const primeiroNome = (nome) => String(nome || "").split(" ")[0];

const descreverCarga = (n) => {
  if (!n) return "Nenhuma conversa agora";
  return n === 1 ? "1 conversa em atendimento" : `${n} conversas em atendimento`;
};

const TransferTicketModal = ({
  modalOpen,
  onClose,
  ticketid,
  ticketWhatsappId,
  currentQueueId,
  currentUserId,
  contatoConhecido = false,
}) => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { can } = usePermissions();
  const podeTrocarConexao = can("connections:view");
  const { loadingWhatsapps, whatsApps } = useWhatsApps();

  const [destinos, setDestinos] = useState({ setores: [], atendentes: [] });
  const [carregandoDestinos, setCarregandoDestinos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Conversa de contato conhecido não tem dono (o backend descarta o
  // atendente), então a única transferência que faz sentido é de setor.
  const [modo, setModo] = useState(contatoConhecido ? "setor" : "atendente");
  const [busca, setBusca] = useState("");
  const [atendenteId, setAtendenteId] = useState(null);
  const [setorId, setSetorId] = useState(null);
  const [recado, setRecado] = useState("");
  const [conexaoId, setConexaoId] = useState(ticketWhatsappId || "");
  const [avancadoAberto, setAvancadoAberto] = useState(false);

  // Cada abertura começa do zero: sobrar a escolha da conversa anterior é
  // como o atendente transferia a conversa errada para a pessoa errada.
  useEffect(() => {
    if (!modalOpen) return;
    setModo(contatoConhecido ? "setor" : "atendente");
    setBusca("");
    setAtendenteId(null);
    setSetorId(null);
    setRecado("");
    setConexaoId(ticketWhatsappId || "");
    setAvancadoAberto(false);

    let ativo = true;
    setCarregandoDestinos(true);
    api
      .get("/tickets/destinos-de-transferencia")
      .then(({ data }) => {
        if (ativo) setDestinos({ setores: data.setores || [], atendentes: data.atendentes || [] });
      })
      .catch((err) => ativo && toastError(err))
      .finally(() => ativo && setCarregandoDestinos(false));

    return () => {
      ativo = false;
    };
  }, [modalOpen, contatoConhecido, ticketWhatsappId]);

  const setorAtual = destinos.setores.find((s) => s.id === currentQueueId) || null;
  const atendente = destinos.atendentes.find((a) => a.id === atendenteId) || null;
  const setor = destinos.setores.find((s) => s.id === setorId) || null;

  // Online primeiro: é para quem a conversa deve ir na maioria das vezes.
  const atendentesFiltrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    return destinos.atendentes
      .filter(
        (a) =>
          !termo ||
          semAcento(a.name).includes(termo) ||
          (a.queues || []).some((q) => semAcento(q.name).includes(termo))
      )
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [destinos.atendentes, busca]);

  const setoresFiltrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    return destinos.setores.filter((s) => !termo || semAcento(s.name).includes(termo));
  }, [destinos.setores, busca]);

  /**
   * Em qual setor a conversa fica quando vai para uma pessoa.
   *
   * O antigo mantinha o setor atual mesmo que a pessoa não atuasse nele, e a
   * conversa ia parar numa fila que ela não enxerga. Aqui: o atual, se a
   * pessoa está nele; senão o primeiro dela; e, se ela não tem setor nenhum,
   * a conversa continua onde está.
   */
  const escolherAtendente = (a) => {
    setAtendenteId(a.id);
    const setoresDela = a.queues || [];
    if (setoresDela.some((q) => q.id === currentQueueId)) setSetorId(currentQueueId);
    else if (setoresDela.length) setSetorId(setoresDela[0].id);
    else setSetorId(null);
  };

  const trocarModo = (novo) => {
    if (novo === modo) return;
    setModo(novo);
    setBusca("");
    setAtendenteId(null);
    setSetorId(null);
  };

  const devolvendo = modo === "setor" && setorId && setorId === currentQueueId;

  const podeConfirmar =
    !carregandoDestinos &&
    (modo === "atendente" ? Boolean(atendente) : Boolean(setor));

  const rotuloConfirmar = (() => {
    if (modo === "atendente") {
      if (!atendente) return "Transferir";
      if (atendente.id === user?.id) return "Assumir conversa";
      return `Transferir para ${primeiroNome(atendente.name)}`;
    }
    if (!setor) return "Transferir";
    if (devolvendo) return "Devolver para a fila";
    return `Enviar para ${setor.name}`;
  })();

  const resumo = (() => {
    if (modo === "atendente" && atendente) {
      const setorFinal = setor || setorAtual;
      const ehVoce = atendente.id === user?.id;
      return (
        <>
          A conversa vai {ehVoce ? <>para <strong>você</strong></> : <>direto para <strong>{atendente.name}</strong></>}
          {setorFinal && (
            <>
              , no setor <strong>{setorFinal.name}</strong>
            </>
          )}
          , já em atendimento.
          {!ehVoce && !atendente.online && " Essa pessoa está offline agora e só verá quando voltar."}
        </>
      );
    }
    if (modo === "setor" && setor) {
      return devolvendo ? (
        <>
          A conversa sai do atendente e volta para a <strong>fila de espera</strong> de{" "}
          <strong>{setor.name}</strong>. Quem estiver no setor pode assumir.
        </>
      ) : (
        <>
          A conversa vai para a <strong>fila de espera</strong> de <strong>{setor.name}</strong>,
          sem atendente. Quem estiver no setor pode assumir.
        </>
      );
    }
    return null;
  })();

  const transferir = async () => {
    if (!ticketid || !podeConfirmar) return;
    setEnviando(true);

    const dados = { isTransfer: true };

    if (modo === "atendente") {
      dados.userId = atendente.id;
      dados.status = "open";
      if (setorId) dados.queueId = setorId;
    } else {
      dados.queueId = setor.id;
      dados.status = "pending";
      dados.removeUser = true;
    }

    if (podeTrocarConexao && conexaoId && conexaoId !== ticketWhatsappId) {
      dados.whatsappId = conexaoId;
    }

    if (recado.trim()) dados.notaDeTransferencia = recado.trim();

    try {
      await api.put(`/tickets/${ticketid}`, dados);

      const paraMim = modo === "atendente" && atendente.id === user?.id;
      toast.success(
        modo === "atendente"
          ? paraMim
            ? "Conversa assumida."
            : `Conversa transferida para ${atendente.name}.`
          : devolvendo
          ? "Conversa devolvida para a fila."
          : `Conversa enviada para ${setor.name}.`
      );

      setEnviando(false);
      onClose();
      // Assumir não tira a conversa da tela; transferir, sim.
      if (!paraMim) history.push("/tickets");
    } catch (err) {
      setEnviando(false);
      toastError(err);
    }
  };

  const listaDeAtendentes = () => {
    if (carregandoDestinos) {
      return (
        <div className={classes.carregando}>
          <CircularProgress size={24} />
        </div>
      );
    }
    if (!atendentesFiltrados.length) {
      return <div className={classes.vazio}>Ninguém encontrado com esse nome ou setor.</div>;
    }
    return atendentesFiltrados.map((a) => {
      const atual = a.id === currentUserId;
      const marcado = a.id === atendenteId;
      const setoresDela = (a.queues || []).map((q) => q.name).join(", ");
      return (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={marcado}
          disabled={atual}
          className={`${classes.item} ${marcado ? classes.itemMarcado : ""}`}
          onClick={() => escolherAtendente(a)}
        >
          <span className={classes.avatar}>
            {iniciais(a.name)}
            <span
              className={classes.presenca}
              style={{ background: a.online ? "#22a55b" : "#9aa1ac" }}
              title={a.online ? "Online" : "Offline"}
            />
          </span>
          <span className={classes.itemTextos}>
            <span className={classes.itemNome}>
              {a.name}
              {a.id === user?.id && <span className={classes.selo}>Você</span>}
              {atual && <span className={classes.selo}>Atendendo agora</span>}
            </span>
            <span className={classes.itemDetalhe} style={{ display: "block" }}>
              {a.online ? descreverCarga(a.emAtendimento) : "Offline"}
              {setoresDela ? ` · ${setoresDela}` : ""}
            </span>
          </span>
          {marcado && <CheckIcon className={classes.marca} fontSize="small" />}
        </button>
      );
    });
  };

  const listaDeSetores = () => {
    if (carregandoDestinos) {
      return (
        <div className={classes.carregando}>
          <CircularProgress size={24} />
        </div>
      );
    }
    if (!setoresFiltrados.length) {
      return <div className={classes.vazio}>Nenhum setor com esse nome.</div>;
    }
    return setoresFiltrados.map((s) => {
      const atual = s.id === currentQueueId;
      // O setor atual só é destino quando há alguém atendendo: aí escolhê-lo
      // é "devolver para a fila". Sem atendente, a conversa já está lá.
      const bloqueado = atual && !currentUserId;
      const marcado = s.id === setorId;
      return (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={marcado}
          disabled={bloqueado}
          className={`${classes.item} ${marcado ? classes.itemMarcado : ""}`}
          onClick={() => setSetorId(s.id)}
        >
          <span className={classes.pontoSetor} style={{ background: s.color || "#9aa1ac" }} />
          <span className={classes.itemTextos}>
            <span className={classes.itemNome}>
              {s.name}
              {atual && <span className={classes.selo}>Setor atual</span>}
              {s.isDefault && !atual && <span className={classes.selo}>Padrão</span>}
            </span>
            {atual && (
              <span className={classes.itemDetalhe} style={{ display: "block" }}>
                {bloqueado ? "A conversa já está na fila deste setor" : "Devolve para a fila, sem atendente"}
              </span>
            )}
          </span>
          {marcado && <CheckIcon className={classes.marca} fontSize="small" />}
        </button>
      );
    });
  };

  const setoresDoAtendente = atendente?.queues || [];

  return (
    <Janela
      open={modalOpen}
      onClose={onClose}
      icone={<SwapHorizIcon />}
      titulo="Transferir conversa"
      subtitulo="Escolha para quem a conversa vai. Você vê o resultado antes de confirmar."
      tamanho="sm"
      onSubmit={transferir}
      rotuloConfirmar={rotuloConfirmar}
      confirmarDesabilitado={!podeConfirmar}
      carregando={enviando}
    >
      {!contatoConhecido && (
        <SecaoDaJanela rotulo="Para quem?">
          <div className={classes.modos} role="radiogroup" aria-label="Tipo de destino">
            <OpcaoDaJanela
              marcada={modo === "atendente"}
              onClick={() => trocarModo("atendente")}
              icone={<PersonOutlineIcon />}
              titulo="Uma pessoa"
              descricao="Vai direto para ela, já em atendimento."
            />
            <OpcaoDaJanela
              marcada={modo === "setor"}
              onClick={() => trocarModo("setor")}
              icone={<GroupsOutlinedIcon />}
              titulo="Um setor"
              descricao="Vai para a fila de espera; quem estiver lá assume."
            />
          </div>
        </SecaoDaJanela>
      )}

      <SecaoDaJanela
        rotulo={modo === "atendente" ? "Escolha a pessoa" : "Escolha o setor"}
        ajuda={
          contatoConhecido
            ? "Conversas de contatos conhecidos não têm dono: qualquer pessoa do setor fala com eles."
            : undefined
        }
      >
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          placeholder={modo === "atendente" ? "Buscar por nome ou setor" : "Buscar setor"}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          onKeyDown={(e) => {
            // Enter na busca não pode enviar o formulário com a escolha
            // anterior ainda marcada.
            if (e.key === "Enter") e.preventDefault();
          }}
        />
        <div className={classes.lista} role="radiogroup">
          {modo === "atendente" ? listaDeAtendentes() : listaDeSetores()}
        </div>
      </SecaoDaJanela>

      {modo === "atendente" && atendente && setoresDoAtendente.length > 1 && (
        <SecaoDaJanela rotulo={`Em qual setor de ${primeiroNome(atendente.name)}?`}>
          <div className={classes.setoresDaPessoa} role="radiogroup">
            {setoresDoAtendente.map((q) => (
              <button
                key={q.id}
                type="button"
                role="radio"
                aria-checked={q.id === setorId}
                className={`${classes.chipSetor} ${q.id === setorId ? classes.chipSetorMarcado : ""}`}
                onClick={() => setSetorId(q.id)}
              >
                <span className={classes.pontoSetor} style={{ background: q.color || "#9aa1ac", width: 9, height: 9 }} />
                {q.name}
              </button>
            ))}
          </div>
        </SecaoDaJanela>
      )}

      {resumo && (
        <SecaoDaJanela rotulo="Recado para quem recebe">
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={5}
            variant="outlined"
            size="small"
            placeholder="Ex.: cliente já aprovou a arte, falta só o prazo de entrega."
            value={recado}
            onChange={(e) => setRecado(e.target.value)}
            inputProps={{ maxLength: 2000 }}
            helperText="Opcional. Fica como nota interna na conversa — o cliente não vê."
          />
        </SecaoDaJanela>
      )}

      {podeTrocarConexao && !loadingWhatsapps && whatsApps.length > 1 && (
        <SecaoDaJanela>
          <button
            type="button"
            className={classes.avancado}
            onClick={() => setAvancadoAberto((v) => !v)}
            aria-expanded={avancadoAberto}
          >
            Trocar o número de WhatsApp
            <ExpandMoreIcon className={avancadoAberto ? classes.girado : ""} />
          </button>
          <Collapse in={avancadoAberto}>
            <TextField
              select
              fullWidth
              size="small"
              variant="outlined"
              label="Número que atende esta conversa"
              value={conexaoId}
              onChange={(e) => setConexaoId(e.target.value)}
              helperText="O cliente passa a receber as mensagens por este número."
              style={{ marginTop: 12 }}
            >
              {whatsApps.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name}
                </MenuItem>
              ))}
            </TextField>
          </Collapse>
        </SecaoDaJanela>
      )}

      {resumo && (
        <SecaoDaJanela>
          <div className={classes.resumo} aria-live="polite">
            <InfoOutlinedIcon />
            <span>{resumo}</span>
          </div>
        </SecaoDaJanela>
      )}
    </Janela>
  );
};

export default TransferTicketModal;
