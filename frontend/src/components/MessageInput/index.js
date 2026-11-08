import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useRef,
} from "react";
// emoji-mart v5: os dados vêm de um pacote separado, o componente React de
// outro, e o CSS deixou de existir (os estilos vão embutidos no componente).
import emojiData from "@emoji-mart/data";
import { useParams } from "react-router-dom";
import Picker from "@emoji-mart/react";
import clsx from "clsx";

import makeStyles from '@mui/styles/makeStyles';
import Paper from "@mui/material/Paper";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import NoteIcon from "@mui/icons-material/Assignment";
import IconButton from "@mui/material/IconButton";
import MoreVert from "@mui/icons-material/MoreVert";
import MoodIcon from "@mui/icons-material/Mood";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import SendIcon from "@mui/icons-material/Send";
import CancelIcon from "@mui/icons-material/Cancel";
import ClearIcon from "@mui/icons-material/Clear";
import MicIcon from "@mui/icons-material/Mic";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFileOutlined";
import {
  FormControlLabel,
  Hidden,
  Menu,
  MenuItem,
  Switch,
} from "@mui/material";
import ClickAwayListener from "@mui/material/ClickAwayListener";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import RecordingTimer from "./RecordingTimer";
import StickerPicker from "../StickerPicker";
import usePermissions from "../../hooks/usePermissions";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { AttendanceSettingsContext } from "../../context/Settings/AttendanceSettingsContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useOutgoingMessages } from "../../context/OutgoingMessages/OutgoingMessagesContext";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import VoiceRecorder, { formatoSuportado } from "../../helpers/VoiceRecorder";

// Uma instância por aba: o gravador segura o microfone enquanto ativo.
const gravador = new VoiceRecorder();

const CHAVE_RASCUNHO = "unmess:rascunho:";

const lerRascunho = (ticketId) => {
  if (!ticketId) return "";
  try {
    return localStorage.getItem(CHAVE_RASCUNHO + ticketId) || "";
  } catch {
    // Navegador com armazenamento bloqueado: o compositor abre vazio, que é
    // exatamente o comportamento antigo.
    return "";
  }
};

const gravarRascunho = (ticketId, texto) => {
  if (!ticketId) return;
  try {
    if (texto && texto.trim()) {
      localStorage.setItem(CHAVE_RASCUNHO + ticketId, texto);
    } else {
      localStorage.removeItem(CHAVE_RASCUNHO + ticketId);
    }
  } catch {
    // Sem armazenamento, o rascunho vale só enquanto a tela estiver aberta.
  }
};

const useStyles = makeStyles(theme => ({
  mainWrapper: {
    background: theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down('md')]: {
      position: "fixed",
      bottom: 0,
      width: "100%",
    },
  },

  newMessageBox: {
    background: theme.palette.background.paper,
    width: "100%",
    display: "flex",
    padding: "7px",
    alignItems: "center",
  },

  messageInputWrapper: {
    padding: 6,
    marginRight: 7,
    background: theme.palette.background.default,
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    borderRadius: 0,
    flex: 1,
    position: "relative",
  },

  messageInput: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
  },

  sendMessageIcons: {
    color: theme.palette.text.secondary,
  },

  nomeAnexo: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    padding: "0 8px",
  },

  rotuloSwitch: {
    marginRight: 7,
    color: theme.palette.text.secondary,
  },

  // Nota interna: fundo âmbar para não haver dúvida de que aquilo não sai
  // para o cliente. O amarelo fixo ficava branco-gelo no modo escuro, com o
  // texto claro por cima -- ilegível justamente no campo em que um engano
  // manda recado interno para o cliente.
  notaInterna: {
    backgroundColor:
      theme.palette.mode === "dark" ? "rgba(224,163,58,0.16)" : "#fff8c4",
    border: `1px solid ${theme.palette.warning.main}`,
  },

  uploadInput: {
    display: "none",
  },

  viewMediaInputWrapper: {
    display: "flex",
    flexDirection: "column",
    padding: "10px 13px",
    position: "relative",
    gap: 8,
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
  },

  // Prévia dos anexos. Antes daqui o compositor mostrava só o nome do
  // arquivo, então quem escolhia a foto errada na caixa de diálogo só
  // descobria depois de o cliente ter recebido.
  faixaAnexos: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 4,
    ...theme.scrollbarStyles,
  },

  cartaoAnexo: {
    position: "relative",
    width: 88,
    height: 88,
    flex: "0 0 auto",
    borderRadius: 4,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  miniatura: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  iconeAnexo: {
    color: theme.palette.text.secondary,
  },

  nomeCartaoAnexo: {
    fontSize: "0.62rem",
    lineHeight: 1.2,
    padding: "2px 4px",
    maxWidth: "100%",
    textAlign: "center",
    color: theme.palette.text.secondary,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    wordBreak: "break-all",
  },

  removerAnexo: {
    position: "absolute",
    top: 2,
    right: 2,
    padding: 2,
    backgroundColor: "rgba(0,0,0,0.55)",
    color: "#fff",
    "&:hover": { backgroundColor: "rgba(0,0,0,0.75)" },
  },

  linhaEnvioAnexo: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  },

  campoLegenda: {
    flex: 1,
    padding: "4px 10px",
    backgroundColor: theme.palette.background.default,
    border: `1px solid ${theme.palette.divider}`,
  },

  emojiBox: {
    position: "absolute",
    bottom: 63,
    width: 40,
    borderTop: `1px solid ${theme.palette.divider}`,
  },

  // A gaveta tem largura própria, diferente da caixa de emoji: ela mostra uma
  // grade de miniaturas e um campo de busca, e precisa de espaço para os dois.
  // O z-index a mantém acima da lista de mensagens.
  stickerBox: {
    position: "absolute",
    bottom: 63,
    zIndex: 10,
  },

  circleLoading: {
    color: theme.palette.primary.main,
    opacity: "70%",
    position: "absolute",
    top: "20%",
    left: "50%",
    marginLeft: -12,
  },

  audioLoading: {
    color: theme.palette.primary.main,
    opacity: "70%",
  },

  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    alignContent: "middle",
  },

  cancelAudioIcon: {
    color: "red",
  },

  sendAudioIcon: {
    color: "green",
  },

  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingLeft: 73,
    paddingRight: 7,
  },

  replyginMsgContainer: {
    flex: 1,
    marginRight: 5,
    overflowY: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 0,
    display: "flex",
    position: "relative",
  },

  replyginMsgBody: {
    padding: 10,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  replyginContactMsgSideColor: {
    flex: "none",
    width: "3px",
    backgroundColor: theme.palette.text.secondary,
  },

  replyginSelfMsgSideColor: {
    flex: "none",
    width: "3px",
    backgroundColor: theme.palette.primary.main,
  },

  messageContactName: {
    display: "flex",
    color: theme.palette.primary.main,
    fontWeight: 700,
  },
  /**
   * Sugestões de resposta rápida.
   *
   * A borda e o cinza do hover eram fixos, então no modo escuro a lista era
   * um retângulo claro flutuando sobre a conversa. E cada item comprimia
   * atalho e texto numa linha só, cortada em 32px de altura: dava para ver o
   * atalho e o começo da frase, nunca a frase inteira.
   */
  messageQuickAnswersWrapper: {
    margin: 0,
    padding: 0,
    position: "absolute",
    bottom: "100%",
    marginBottom: 6,
    left: 0,
    width: "100%",
    maxHeight: 260,
    overflowY: "auto",
    zIndex: 20,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[3],
    ...theme.scrollbarStyles,
  },

  itemResposta: {
    listStyle: "none",
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "6px 10px",
    cursor: "pointer",
    "&:hover": { background: theme.palette.action.hover },
  },

  // O item que o Enter vai inserir. Fundo, e não só hover: o teclado move a
  // seleção sem mexer o ponteiro.
  itemRespostaAtivo: {
    background: theme.palette.action.selected,
  },

  atalhoResposta: {
    flexShrink: 0,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontWeight: 700,
    fontSize: "0.8rem",
    color: theme.palette.primary.main,
  },

  textoResposta: {
    flex: 1,
    minWidth: 0,
    fontSize: "0.82rem",
    color: theme.palette.text.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  dicaResposta: {
    padding: "4px 10px",
    fontSize: "0.7rem",
    color: theme.palette.text.disabled,
    borderTop: `1px solid ${theme.palette.divider}`,
    position: "sticky",
    bottom: 0,
    background: theme.palette.background.paper,
  },
}));

const MessageInput = ({ ticketStatus }) => {
  const classes = useStyles();
  const { can } = usePermissions();
  const { ticketId } = useParams();

  const [medias, setMedias] = useState([]);
  // Legenda dos anexos. Vai junto do primeiro arquivo, como no WhatsApp.
  const [legenda, setLegenda] = useState("");
  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [quickAnswers, setQuickAnswer] = useState([]);
  const [typeBar, setTypeBar] = useState(false);
  // Qual sugestão o Enter insere. Sem isso a lista só respondia ao clique —
  // numa função cujo motivo de existir é não tirar a mão do teclado.
  const [quickIndice, setQuickIndice] = useState(0);
  const inputRef = useRef();
  const [anchorEl, setAnchorEl] = useState(null);
  const { setReplyingMessage, replyingMessage } =
    useContext(ReplyMessageContext);
  const { enviar } = useOutgoingMessages();
  const { user } = useContext(AuthContext);
  const { isEnabled, loading: settingsLoading } = useContext(
    AttendanceSettingsContext
  );

  // A preferência local ganha do padrão da empresa, mas na primeira vez que o
  // atendente usa o sistema o padrão vem de Configurações › Geral.
  const [signMessage, setSignMessage] = useLocalStorage("signOption", null);
  // Modo nota interna: o que for digitado fica só para a equipe.
  const [internalNote, setInternalNote] = useState(false);

  useEffect(() => {
    if (settingsLoading) return;
    if (signMessage === null || signMessage === undefined) {
      setSignMessage(isEnabled("signMessages"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [replyingMessage]);

  // O texto atual, para a limpeza do efeito abaixo poder gravá-lo: a função
  // de cleanup enxerga o estado do render em que foi criada, e esse render é
  // sempre anterior à última tecla digitada.
  const mensagemRef = useRef("");
  useEffect(() => {
    mensagemRef.current = inputMessage;
  }, [inputMessage]);

  useEffect(() => {
    inputRef.current?.focus();
    setInputMessage(lerRascunho(ticketId));

    return () => {
      gravarRascunho(ticketId, mensagemRef.current);
      setInputMessage("");
      setShowEmoji(false);
      setMedias([]);
      setLegenda("");
      setReplyingMessage(null);
    };
  }, [ticketId, setReplyingMessage]);

  /**
   * Miniaturas dos anexos escolhidos.
   *
   * A URL temporária precisa ser devolvida ao navegador quando a lista muda:
   * sem isso cada arquivo escolhido e descartado deixava o conteúdo inteiro
   * preso na memória da aba até a próxima recarga.
   */
  const previas = useMemo(
    () =>
      medias.map(media => ({
        nome: media.name,
        tipo: media.type,
        url: media.type?.startsWith("image/")
          ? URL.createObjectURL(media)
          : null,
      })),
    [medias]
  );

  useEffect(
    () => () => {
      previas.forEach(previa => previa.url && URL.revokeObjectURL(previa.url));
    },
    [previas]
  );

  const handleChangeInput = e => {
    setInputMessage(e.target.value);
  };

  const handleQuickAnswersClick = value => {
    setInputMessage(value);
    setTypeBar(false);
    setQuickIndice(0);
    inputRef.current?.focus();
  };

  const handleAddEmoji = e => {
    let emoji = e.native;
    setInputMessage(prevState => prevState + emoji);
  };

  const handleChangeMedias = e => {
    if (!e.target.files) {
      return;
    }

    // Acumula em vez de substituir: com a prévia aberta é natural clicar no
    // clipe de novo para juntar mais um arquivo ao mesmo envio.
    const escolhidos = Array.from(e.target.files);
    setMedias(anteriores => [...anteriores, ...escolhidos]);

    // Sem isso, escolher de novo um arquivo que acabou de ser removido não
    // dispara evento nenhum: o valor do campo não mudou.
    e.target.value = "";
  };

  const removerMedia = indice => {
    setMedias(anteriores => anteriores.filter((_, i) => i !== indice));
  };

  const limparAnexos = () => {
    setMedias([]);
    setLegenda("");
  };

  const handleInputPaste = e => {
    if (e.clipboardData.files[0]) {
      setMedias([e.clipboardData.files[0]]);
    }
  };

  const handleUploadMedia = e => {
    e.preventDefault();
    if (medias.length === 0) return;

    // O envio segue pela fila, fora daqui: o compositor volta a ficar livre
    // na hora e o andamento aparece na própria conversa.
    //
    // As miniaturas do balão são URLs novas, e não as da prévia do compositor:
    // estas são devolvidas ao navegador assim que a lista de anexos é limpa,
    // logo abaixo, e a imagem do balão apareceria quebrada. Quem as libera
    // agora é a fila, quando a mensagem sai da tela.
    enviar({
      ticketId,
      medias,
      caption: legenda,
      previas: medias.map(media => ({
        nome: media.name,
        tipo: media.type,
        url: media.type?.startsWith("image/")
          ? URL.createObjectURL(media)
          : null,
      })),
    });

    limparAnexos();
    inputRef.current?.focus();
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "") return;

    // Nota interna não passa pelo WhatsApp: endpoint próprio.
    if (internalNote) {
      setLoading(true);
      try {
        await api.post(`/messages/${ticketId}/notes`, {
          body: inputMessage.trim(),
        });
        gravarRascunho(ticketId, "");
        setInputMessage("");
        setShowEmoji(false);
        setReplyingMessage(null);
      } catch (err) {
        // Idem para a nota interna: falhou, o texto fica.
        toastError(err);
      }
      setLoading(false);
      inputRef.current?.focus();
      return;
    }

    // Daqui em diante quem cuida do envio é a fila: a mensagem já aparece na
    // conversa como "enviando" e a caixa de texto é liberada no mesmo
    // instante. Se falhar, o erro aparece no próprio balão, com a opção de
    // tentar de novo — em vez de o texto voltar para cá sem explicação.
    enviar({
      ticketId,
      body: signMessage
        ? `*${user?.name}:*\n${inputMessage.trim()}`
        : inputMessage.trim(),
      quotedMsg: replyingMessage,
    });

    gravarRascunho(ticketId, "");
    setInputMessage("");
    setReplyingMessage(null);
    setShowEmoji(false);

    // O cursor volta para a caixa: depois de enviar, o passo seguinte é quase
    // sempre continuar escrevendo.
    inputRef.current?.focus();
  };

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      // O navegador só expõe o microfone em contexto seguro: HTTPS ou
      // localhost. Acessando o sistema pelo IP da rede em HTTP puro,
      // navigator.mediaDevices vem indefinido — sem esta checagem o atendente
      // recebia um "cannot read properties of undefined" sem sentido.
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(i18n.t("messageInput.recording.insecureContext"));
      }

      if (!formatoSuportado()) {
        throw new Error(i18n.t("messageInput.recording.unavailable"));
      }

      await gravador.start();
      setRecording(true);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  /**
   * Sugestões enquanto se digita "/".
   *
   * Roda em efeito, sobre o valor já aplicado ao estado, com uma pausa curta:
   * assim a consulta corresponde ao que está na tela e uma frase inteira não
   * vira uma requisição por letra.
   */
  useEffect(() => {
    if (!inputMessage.startsWith("/") || internalNote) {
      setTypeBar(false);
      return undefined;
    }

    const termo = inputMessage.substring(1);
    const cronometro = setTimeout(async () => {
      try {
        const { data } = await api.get("/quick-answers", {
          params: { searchParam: termo },
        });
        const lista = data.quickAnswers || [];
        setQuickAnswer(lista);
        setQuickIndice(0);
        setTypeBar(lista.length > 0);
      } catch {
        // Buscar sugestão é apoio: falhar aqui não pode atrapalhar quem só
        // queria escrever uma barra na mensagem.
        setTypeBar(false);
      }
    }, 250);

    return () => clearTimeout(cronometro);
  }, [inputMessage, internalNote]);

  /**
   * Teclas enquanto a lista de sugestões está aberta.
   *
   * Antes o Enter mandava a mensagem com a barra e o atalho crus para o
   * cliente, mesmo com a lista aberta na frente do atendente.
   */
  const handleTeclaNaCaixa = e => {
    if (typeBar && quickAnswers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setQuickIndice(i => (i + 1) % quickAnswers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setQuickIndice(i => (i - 1 + quickAnswers.length) % quickAnswers.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleQuickAnswersClick(quickAnswers[quickIndice].message);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTypeBar(false);
        return;
      }
    }

    if (loading || e.shiftKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleUploadAudio = async () => {
    setLoading(true);
    try {
      const gravacao = await gravador.stop();

      // Opus a 1s de fala fica bem abaixo de 10 KB, então o limite antigo
      // descartaria áudio legítimo. 2 KB separa o clique acidental da fala.
      if (!gravacao || gravacao.blob.size < 2000) {
        toast.info(i18n.t("messageInput.recording.tooShort"));
        setLoading(false);
        setRecording(false);
        return;
      }

      const filename = `${new Date().getTime()}.${gravacao.extensao}`;
      const arquivo = new File([gravacao.blob], filename, {
        type: gravacao.blob.type || "audio/ogg",
      });

      // Pela fila, como os demais anexos: o atendente pode gravar o próximo
      // áudio ou trocar de conversa enquanto este sobe.
      enviar({
        ticketId,
        medias: [arquivo],
        previas: [{ nome: i18n.t("messageInput.recording.label"), url: null }],
      });
    } catch (err) {
      toastError(err);
    }

    setRecording(false);
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleCancelAudio = async () => {
    try {
      // Descarta o áudio, mas precisa parar mesmo assim para soltar o
      // microfone — senão o indicador de gravação fica aceso no navegador.
      await gravador.stop();
    } catch (err) {
      toastError(err);
    } finally {
      setRecording(false);
    }
  };

  const handleOpenMenuClick = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = event => {
    setAnchorEl(null);
  };

  const renderReplyingMessage = message => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span
            className={clsx(classes.replyginContactMsgSideColor, {
              [classes.replyginSelfMsgSideColor]: !message.fromMe,
            })}
          ></span>
          <div className={classes.replyginMsgBody}>
            {!message.fromMe && (
              <span className={classes.messageContactName}>
                {message.contact?.name}
              </span>
            )}
            {message.body}
          </div>
        </div>
        <IconButton
          aria-label="showRecorder"
          component="span"
          disabled={loading || ticketStatus !== "open"}
          onClick={() => setReplyingMessage(null)}
          size="large">
          <ClearIcon className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  /**
   * Sem permissão de responder, a conversa fica só de leitura.
   *
   * Um cargo pode legitimamente ver o atendimento sem participar dele —
   * supervisão, auditoria, treinamento. O servidor já recusa o envio; sem
   * este aviso, a caixa de texto aceitaria a mensagem, o botão pareceria
   * funcionar e o erro só apareceria depois de escrever tudo.
   */
  if (!can("tickets:edit")) {
    return (
      <Paper square elevation={0} className={classes.mainWrapper}>
        <div className={classes.newMessageBox}>
          <span style={{ padding: "12px 16px", fontSize: 13, opacity: 0.7 }}>
            Você tem acesso de leitura a esta conversa e não pode responder.
          </span>
        </div>
      </Paper>
    );
  }

  if (medias.length > 0)
    return (
      <Paper elevation={0} square className={classes.viewMediaInputWrapper}>
        <div className={classes.faixaAnexos}>
          {previas.map((previa, indice) => (
            <div
              key={`${previa.nome}-${indice}`}
              className={classes.cartaoAnexo}
            >
              {previa.url ? (
                <img
                  src={previa.url}
                  alt={previa.nome}
                  className={classes.miniatura}
                />
              ) : (
                <>
                  <InsertDriveFileIcon className={classes.iconeAnexo} />
                  <span className={classes.nomeCartaoAnexo}>{previa.nome}</span>
                </>
              )}
              <Tooltip
                title={i18n.t("messagesInput.tooltips.removeAttach")}
                arrow
              >
                <IconButton
                  aria-label={i18n.t("messagesInput.tooltips.removeAttach")}
                  className={classes.removerAnexo}
                  onClick={() => removerMedia(indice)}
                  size="small"
                >
                  <ClearIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </div>
          ))}
        </div>

        <div className={classes.linhaEnvioAnexo}>
          <Tooltip title={i18n.t("messagesInput.tooltips.cancelAttach")} arrow>
            <IconButton
              aria-label={i18n.t("messagesInput.tooltips.cancelAttach")}
              component="span"
              onClick={limparAnexos}
              size="large"
            >
              <CancelIcon className={classes.sendMessageIcons} />
            </IconButton>
          </Tooltip>

          <InputBase
            className={classes.campoLegenda}
            placeholder={i18n.t("messagesInput.captionPlaceholder")}
            multiline
            maxRows={3}
            value={legenda}
            onChange={e => setLegenda(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleUploadMedia(e);
              }
            }}
          />

          <Tooltip title={i18n.t("messagesInput.tooltips.sendAttach")} arrow>
            <span>
              <IconButton
                aria-label={i18n.t("messagesInput.tooltips.sendAttach")}
                component="span"
                onClick={handleUploadMedia}
                size="large"
              >
                <SendIcon className={classes.sendMessageIcons} />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </Paper>
    );
  else {
    return (
      <Paper square elevation={0} className={classes.mainWrapper}>
        {replyingMessage && renderReplyingMessage(replyingMessage)}
        <div className={classes.newMessageBox}>
          <Hidden only={["sm", "xs"]}>
            <Tooltip title={i18n.t("messagesInput.tooltips.emoji")} arrow>
              <span>
                <IconButton
                  aria-label={i18n.t("messagesInput.tooltips.emoji")}
                  component="span"
                  disabled={loading || recording || ticketStatus !== "open"}
                  onClick={() => setShowEmoji(prevState => !prevState)}
                  size="large">
                  <MoodIcon className={classes.sendMessageIcons} />
                </IconButton>
              </span>
            </Tooltip>
            {showEmoji ? (
              <div className={classes.emojiBox}>
                <ClickAwayListener onClickAway={e => setShowEmoji(false)}>
                  <Picker
                    data={emojiData}
                    perLine={16}
                    previewPosition="none"
                    skinTonePosition="none"
                    locale="pt"
                    onEmojiSelect={handleAddEmoji}
                  />
                </ClickAwayListener>
              </div>
            ) : null}

            {can("stickers:send") && (
              <Tooltip title={i18n.t("messagesInput.tooltips.stickers")} arrow>
                <span>
                  <IconButton
                    aria-label="stickerPicker"
                    component="span"
                    disabled={loading || recording || ticketStatus !== "open"}
                    onClick={() => setShowStickers(prev => !prev)}
                    size="large">
                    <EmojiEmotionsIcon className={classes.sendMessageIcons} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {showStickers ? (
              <div className={classes.stickerBox}>
                <ClickAwayListener onClickAway={() => setShowStickers(false)}>
                  <div>
                    <StickerPicker
                      ticketId={ticketId}
                      onEnviada={() => setShowStickers(false)}
                    />
                  </div>
                </ClickAwayListener>
              </div>
            ) : null}

            <input
              multiple
              type="file"
              id="upload-button"
              disabled={loading || recording || ticketStatus !== "open"}
              className={classes.uploadInput}
              onChange={handleChangeMedias}
            />
            <label htmlFor="upload-button">
              <Tooltip title={i18n.t("messagesInput.tooltips.attach")} arrow>
              <IconButton
                aria-label={i18n.t("messagesInput.tooltips.attach")}
                component="span"
                disabled={loading || recording || ticketStatus !== "open"}
                size="large">
                <AttachFileIcon className={classes.sendMessageIcons} />
              </IconButton>
              </Tooltip>
            </label>
            <Tooltip title={i18n.t("messagesInput.internalNoteTooltip")} arrow>
              <span>
                <IconButton
                  aria-label="internal-note"
                  disabled={loading || recording || ticketStatus !== "open"}
                  onClick={() => setInternalNote(prev => !prev)}
                  size="large">
                  <NoteIcon
                    className={classes.sendMessageIcons}
                    color={internalNote ? "warning" : undefined}
                  />
                </IconButton>
              </span>
            </Tooltip>
            <FormControlLabel
              className={classes.rotuloSwitch}
              label={i18n.t("messagesInput.signMessage")}
              labelPlacement="start"
              control={
                <Switch
                  size="small"
                  disabled={internalNote}
                  checked={!!signMessage}
                  onChange={e => {
                    setSignMessage(e.target.checked);
                  }}
                  name="showAllTickets"
                  color="primary"
                />
              }
            />
          </Hidden>
          <Hidden only={["md", "lg", "xl"]}>
            <IconButton
              aria-controls="simple-menu"
              aria-haspopup="true"
              onClick={handleOpenMenuClick}
              size="large">
              <MoreVert></MoreVert>
            </IconButton>
            <Menu
              id="simple-menu"
              keepMounted
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuItemClick}
            >
              <MenuItem onClick={handleMenuItemClick}>
                <IconButton
                  aria-label="emojiPicker"
                  component="span"
                  disabled={loading || recording || ticketStatus !== "open"}
                  onClick={e => setShowEmoji(prevState => !prevState)}
                  size="large">
                  <MoodIcon className={classes.sendMessageIcons} />
                </IconButton>
              </MenuItem>
              <MenuItem onClick={handleMenuItemClick}>
                <input
                  multiple
                  type="file"
                  id="upload-button"
                  disabled={loading || recording || ticketStatus !== "open"}
                  className={classes.uploadInput}
                  onChange={handleChangeMedias}
                />
                <label htmlFor="upload-button">
                  <IconButton
                    aria-label="upload"
                    component="span"
                    disabled={loading || recording || ticketStatus !== "open"}
                    size="large">
                    <AttachFileIcon className={classes.sendMessageIcons} />
                  </IconButton>
                </label>
              </MenuItem>
              <MenuItem onClick={handleMenuItemClick}>
                <FormControlLabel
                  className={classes.rotuloSwitch}
                  label={i18n.t("messagesInput.signMessage")}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={!!signMessage}
                      onChange={e => {
                        setSignMessage(e.target.checked);
                      }}
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              </MenuItem>
            </Menu>
          </Hidden>
          <div
            className={clsx(classes.messageInputWrapper, {
              [classes.notaInterna]: internalNote,
            })}
          >
            <InputBase
              inputRef={inputRef}
              className={classes.messageInput}
              placeholder={
                ticketStatus !== "open"
                  ? i18n.t("messagesInput.placeholderClosed")
                  : internalNote
                  ? i18n.t("messagesInput.placeholderInternalNote")
                  : i18n.t("messagesInput.placeholderOpen")
              }
              multiline
              maxRows={5}
              value={inputMessage}
              onChange={handleChangeInput}
              disabled={recording || loading || ticketStatus !== "open"}
              onPaste={e => {
                ticketStatus === "open" && handleInputPaste(e);
              }}
              onKeyDown={handleTeclaNaCaixa}
              inputProps={{
                "aria-autocomplete": "list",
                "aria-expanded": typeBar,
                "aria-controls": typeBar ? "sugestoes-resposta-rapida" : undefined,
              }}
            />
            {typeBar && (
              <ul
                id="sugestoes-resposta-rapida"
                role="listbox"
                className={classes.messageQuickAnswersWrapper}
              >
                {quickAnswers.map((value, index) => (
                  <li
                    key={value.id ?? index}
                    role="option"
                    aria-selected={index === quickIndice}
                    className={clsx(classes.itemResposta, {
                      [classes.itemRespostaAtivo]: index === quickIndice,
                    })}
                    // mousedown, e não click: o clique só chega depois do
                    // blur da caixa, e o blur já teria fechado a lista.
                    onMouseDown={e => {
                      e.preventDefault();
                      handleQuickAnswersClick(value.message);
                    }}
                    onMouseEnter={() => setQuickIndice(index)}
                  >
                    <span className={classes.atalhoResposta}>
                      /{value.shortcut}
                    </span>
                    <span className={classes.textoResposta}>{value.message}</span>
                  </li>
                ))}
                <li className={classes.dicaResposta}>
                  {i18n.t("messagesInput.quickAnswersHint")}
                </li>
              </ul>
            )}
          </div>
          {inputMessage ? (
            <Tooltip title={i18n.t("messagesInput.tooltips.send")} arrow>
              <span>
                <IconButton
                  aria-label={i18n.t("messagesInput.tooltips.send")}
                  component="span"
                  onClick={handleSendMessage}
                  disabled={loading}
                  size="large">
                  <SendIcon className={classes.sendMessageIcons} />
                </IconButton>
              </span>
            </Tooltip>
          ) : recording ? (
            <div className={classes.recorderWrapper}>
              <IconButton
                aria-label="cancelRecording"
                component="span"
                fontSize="large"
                disabled={loading}
                onClick={handleCancelAudio}
                size="large">
                <HighlightOffIcon className={classes.cancelAudioIcon} />
              </IconButton>
              {loading ? (
                <div>
                  <CircularProgress className={classes.audioLoading} />
                </div>
              ) : (
                <RecordingTimer />
              )}

              <IconButton
                aria-label="sendRecordedAudio"
                component="span"
                onClick={handleUploadAudio}
                disabled={loading}
                size="large">
                <CheckCircleOutlineIcon className={classes.sendAudioIcon} />
              </IconButton>
            </div>
          ) : (
            <Tooltip title={i18n.t("messagesInput.tooltips.record")} arrow>
              <span>
                <IconButton
                  aria-label={i18n.t("messagesInput.tooltips.record")}
                  component="span"
                  disabled={loading || ticketStatus !== "open"}
                  onClick={handleStartRecording}
                  size="large">
                  <MicIcon className={classes.sendMessageIcons} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </div>
      </Paper>
    );
  }
};

export default MessageInput;
