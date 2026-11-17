import React, { useState, useEffect, useCallback, useRef } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import UploadIcon from "@mui/icons-material/UploadFileOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import StarIcon from "@mui/icons-material/Star";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFileOutlined";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import usePermissions from "../../../hooks/usePermissions";
import { mediaUrl } from "../../../helpers/mediaUrl";

const useStyles = makeStyles((theme) => ({
  barra: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  grade: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 12,
  },

  peca: {
    position: "relative",
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },

  // A capa se distingue pela borda, e não só pela estrela: de relance é a
  // borda que responde qual delas vai para o card do quadro.
  capa: {
    borderColor: theme.palette.primary.main,
    boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
  },

  miniatura: {
    width: "100%",
    height: 110,
    objectFit: "cover",
    display: "block",
    background: theme.palette.action.hover,
  },

  semImagem: {
    width: "100%",
    height: 110,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: theme.palette.action.hover,
    color: theme.palette.text.secondary,
  },

  legenda: {
    padding: "6px 8px",
    fontSize: 11,
    lineHeight: 1.3,
    wordBreak: "break-word",
    flex: 1,
  },

  acoes: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: `1px solid ${theme.palette.divider}`,
  },

  vazio: {
    padding: theme.spacing(3),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },

  centro: { display: "flex", justifyContent: "center", padding: 24 },

  jaImportada: {
    opacity: 0.45,
    pointerEvents: "none",
  },
}));

const ehImagem = (mimetype) => String(mimetype || "").startsWith("image/");

/**
 * O material do pedido: a arte, o arquivo de impressão, a referência.
 *
 * O texto do pedido não diz o que vai ser produzido -- "banner 3x1" pode ser
 * qualquer coisa. Aqui o material ganha lugar próprio, e o que estiver marcado
 * como capa aparece no card do Kanban, que é onde a Produção olha.
 *
 * Dois caminhos de entrada, porque o material chega dos dois jeitos: o arquivo
 * que o atendente tem na máquina, e a imagem que o cliente já mandou no
 * WhatsApp. Sem o segundo, a arte teria que ser baixada do chat para ser subida
 * aqui de novo -- e ninguém faria.
 */
const AbaMaterial = ({ deal, onSalvo }) => {
  const classes = useStyles();
  const { can } = usePermissions();
  const podeEditar = can("crm:edit");

  const [anexos, setAnexos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [seletorAberto, setSeletorAberto] = useState(false);
  const [midias, setMidias] = useState([]);
  const [carregandoMidias, setCarregandoMidias] = useState(false);

  const inputArquivo = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/deals/${deal.id}/attachments`);
      setAnexos(data.attachments || []);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, [deal.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const aoMudar = async () => {
    await carregar();
    if (onSalvo) await onSalvo();
  };

  const enviarArquivos = async (arquivos) => {
    if (!arquivos?.length) return;

    const corpo = new FormData();
    Array.from(arquivos).forEach((arquivo) => corpo.append("files", arquivo));

    setEnviando(true);
    try {
      await api.post(`/deals/${deal.id}/attachments`, corpo, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await aoMudar();
    } catch (err) {
      toastError(err);
    } finally {
      setEnviando(false);
      // Limpa o input para o mesmo arquivo poder ser reenviado depois de um
      // erro; sem isso o navegador não dispara o onChange de novo.
      if (inputArquivo.current) inputArquivo.current.value = "";
    }
  };

  const abrirSeletor = async () => {
    setSeletorAberto(true);
    setCarregandoMidias(true);
    try {
      const { data } = await api.get(`/deals/${deal.id}/midias-da-conversa`);
      setMidias(data.midias || []);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregandoMidias(false);
    }
  };

  const importar = async (messageId) => {
    try {
      await api.post(`/deals/${deal.id}/attachments/da-conversa`, { messageId });
      setSeletorAberto(false);
      await aoMudar();
    } catch (err) {
      toastError(err);
    }
  };

  const definirCapa = async (attachmentId) => {
    try {
      await api.put(`/deals/${deal.id}/attachments/${attachmentId}/capa`);
      await aoMudar();
    } catch (err) {
      toastError(err);
    }
  };

  const remover = async (attachmentId) => {
    try {
      await api.delete(`/deals/${deal.id}/attachments/${attachmentId}`);
      await aoMudar();
    } catch (err) {
      toastError(err);
    }
  };

  if (carregando) {
    return (
      <div className={classes.centro}>
        <CircularProgress size={24} />
      </div>
    );
  }

  return (
    <>
      <div className={classes.barra}>
        {podeEditar && (
          <>
            <input
              ref={inputArquivo}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={(e) => enviarArquivos(e.target.files)}
            />
            <Button
              size="small"
              startIcon={<WhatsAppIcon />}
              onClick={abrirSeletor}
            >
              Escolher da conversa
            </Button>
            <Button
              size="small"
              variant="contained"
              disableElevation
              startIcon={
                enviando ? <CircularProgress size={14} /> : <UploadIcon />
              }
              disabled={enviando}
              onClick={() => inputArquivo.current?.click()}
            >
              Enviar arquivo
            </Button>
          </>
        )}
      </div>

      {anexos.length === 0 ? (
        <div className={classes.vazio}>
          <Typography variant="body2">
            Nenhum material neste pedido. Envie a arte ou traga a imagem da
            conversa — a que estiver marcada como capa aparece no card do quadro.
          </Typography>
        </div>
      ) : (
        <div className={classes.grade}>
          {anexos.map((anexo) => (
            <div
              key={anexo.id}
              className={`${classes.peca} ${
                anexo.isPreview ? classes.capa : ""
              }`}
            >
              <a
                href={mediaUrl(anexo.fileName)}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir em tamanho real"
              >
                {ehImagem(anexo.mimetype) ? (
                  <img
                    className={classes.miniatura}
                    src={mediaUrl(anexo.fileName)}
                    alt={anexo.name}
                    loading="lazy"
                  />
                ) : (
                  <div className={classes.semImagem}>
                    <InsertDriveFileIcon />
                  </div>
                )}
              </a>

              <div className={classes.legenda}>{anexo.name}</div>

              {podeEditar && (
                <div className={classes.acoes}>
                  <Tooltip
                    title={
                      anexo.isPreview
                        ? "É a capa do card"
                        : "Usar como capa do card"
                    }
                    arrow
                  >
                    {/* O span existe porque o Tooltip precisa de um filho que
                        aceite ref mesmo quando o botão está desabilitado. */}
                    <span>
                      <IconButton
                        size="small"
                        color={anexo.isPreview ? "primary" : "default"}
                        disabled={anexo.isPreview || !ehImagem(anexo.mimetype)}
                        onClick={() => definirCapa(anexo.id)}
                      >
                        {anexo.isPreview ? (
                          <StarIcon fontSize="small" />
                        ) : (
                          <StarOutlineIcon fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>

                  <IconButton
                    size="small"
                    onClick={() => remover(anexo.id)}
                    title="Remover material"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={seletorAberto}
        onClose={() => setSeletorAberto(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Mídias da conversa</DialogTitle>
        <DialogContent dividers>
          {carregandoMidias ? (
            <div className={classes.centro}>
              <CircularProgress size={24} />
            </div>
          ) : midias.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              Nenhuma mídia nas conversas ligadas a este pedido. O vínculo com a
              conversa é criado ao abrir o pedido a partir do chat.
            </Typography>
          ) : (
            <div className={classes.grade}>
              {midias.map((midia) => (
                <div
                  key={midia.id}
                  className={`${classes.peca} ${
                    midia.jaImportada ? classes.jaImportada : ""
                  }`}
                  style={{ cursor: midia.jaImportada ? "default" : "pointer" }}
                  onClick={() => !midia.jaImportada && importar(midia.id)}
                >
                  {midia.mediaType === "image" ? (
                    <img
                      className={classes.miniatura}
                      src={mediaUrl(midia.mediaUrl)}
                      alt={midia.body || "Mídia da conversa"}
                      loading="lazy"
                    />
                  ) : (
                    <div className={classes.semImagem}>
                      <InsertDriveFileIcon />
                    </div>
                  )}
                  <div className={classes.legenda}>
                    {midia.jaImportada
                      ? "Já está no material"
                      : midia.body || "Sem legenda"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeletorAberto(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AbaMaterial;
