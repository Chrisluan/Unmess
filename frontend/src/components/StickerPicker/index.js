import React, { useEffect, useState, useRef } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import InputBase from "@mui/material/InputBase";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { mediaUrl } from "../../helpers/mediaUrl";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles(theme => ({
  gaveta: {
    width: 320,
    maxWidth: "90vw",
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  busca: {
    padding: "4px 10px",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    fontSize: 14,
  },

  // Altura fixa com rolagem própria: a gaveta abre sobre a conversa e não pode
  // crescer até empurrar o campo de digitação para fora da tela.
  grade: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 6,
    maxHeight: 240,
    overflowY: "auto",
  },

  figurinha: {
    width: "100%",
    aspectRatio: "1",
    objectFit: "contain",
    cursor: "pointer",
    borderRadius: 6,
    padding: 4,
    background: "transparent",
    border: "none",
    "&:hover": {
      background: theme.palette.action.hover,
    },
    "&:disabled": {
      opacity: 0.4,
      cursor: "wait",
    },
  },

  vazio: {
    padding: "18px 6px",
    textAlign: "center",
  },

  // O item precisa ser o bloco de referência para o botão de excluir, que fica
  // sobreposto no canto e só aparece ao passar o mouse.
  item: {
    position: "relative",
    "&:hover $excluir": { opacity: 1 },
  },

  excluir: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    padding: 0,
    minWidth: 0,
    borderRadius: "50%",
    background: theme.palette.error.main,
    color: "#fff",
    border: "none",
    cursor: "pointer",
    opacity: 0,
    transition: "opacity .15s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "&:hover": { background: theme.palette.error.dark },
  },

  rodape: {
    borderTop: `1px solid ${theme.palette.divider}`,
    paddingTop: 6,
  },

  oculto: { display: "none" },
}));

/**
 * Gaveta de figurinhas da empresa.
 *
 * O envio sai daqui direto para a API, sem passar pelo campo de mensagem: o
 * que se manda é o id de uma figurinha já guardada, não um arquivo novo. Enviar
 * pelo caminho normal de mídia faria o servidor descartar o arquivo depois do
 * envio, esvaziando a biblioteca a cada uso.
 */
const StickerPicker = ({ ticketId, onEnviada }) => {
  const classes = useStyles();
  const { can } = usePermissions();
  const inputArquivo = useRef(null);

  const [stickers, setStickers] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(null);
  const [subindo, setSubindo] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  const podeAdicionar = can("stickers:create");
  const podeExcluir = can("stickers:delete");

  useEffect(() => {
    let ativo = true;

    // O atraso evita uma busca por tecla digitada; a lista é pequena, mas a
    // conexão pode ser a do túnel, com o servidor do outro lado da internet.
    const relogio = setTimeout(async () => {
      try {
        const { data } = await api.get("/stickers", {
          params: busca ? { searchParam: busca } : {},
        });
        if (ativo) setStickers(data.stickers || []);
      } catch (err) {
        if (ativo) toastError(err);
      } finally {
        if (ativo) setCarregando(false);
      }
    }, busca ? 350 : 0);

    return () => {
      ativo = false;
      clearTimeout(relogio);
    };
  }, [busca, recarregar]);

  const handleEnviar = async sticker => {
    if (enviando) return;
    setEnviando(sticker.id);

    try {
      await api.post(`/stickers/${sticker.id}/send/${ticketId}`);
      if (onEnviada) onEnviada();
    } catch (err) {
      toastError(err);
    } finally {
      setEnviando(null);
    }
  };

  /**
   * Adiciona uma figurinha à biblioteca.
   *
   * O arquivo vai como veio -- PNG, GIF, vídeo curto -- e quem converte para o
   * WebP que o WhatsApp exige é o servidor. Converter no navegador obrigaria a
   * carregar um codificador inteiro só para isso.
   */
  const handleArquivo = async evento => {
    const arquivo = evento.target.files?.[0];
    evento.target.value = ""; // permite reenviar o mesmo arquivo depois
    if (!arquivo) return;

    const sugestao = arquivo.name.replace(/\.[^.]+$/, "").slice(0, 60);
    const nome = window.prompt("Nome da figurinha:", sugestao);
    if (!nome?.trim()) return;

    const dados = new FormData();
    dados.append("file", arquivo);
    dados.append("name", nome.trim());

    setSubindo(true);
    try {
      await api.post("/stickers", dados, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRecarregar(n => n + 1);
    } catch (err) {
      toastError(err);
    } finally {
      setSubindo(false);
    }
  };

  const handleExcluir = async (evento, sticker) => {
    // Sem isto o clique atravessaria para o botão de baixo e enviaria a
    // figurinha para o cliente em vez de apagá-la.
    evento.stopPropagation();

    if (!window.confirm(`Excluir a figurinha "${sticker.name}"?`)) return;

    try {
      await api.delete(`/stickers/${sticker.id}`);
      setRecarregar(n => n + 1);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Paper className={classes.gaveta} elevation={3}>
      <InputBase
        className={classes.busca}
        placeholder="Buscar figurinha"
        value={busca}
        onChange={e => setBusca(e.target.value)}
        autoFocus
      />

      {carregando ? (
        <div className={classes.vazio}>
          <CircularProgress size={24} />
        </div>
      ) : stickers.length === 0 ? (
        <div className={classes.vazio}>
          <Typography variant="body2" color="textSecondary">
            {busca
              ? "Nenhuma figurinha com esse nome."
              : "Nenhuma figurinha cadastrada ainda."}
          </Typography>
        </div>
      ) : (
        <div className={classes.grade}>
          {stickers.map(sticker => (
            <div key={sticker.id} className={classes.item}>
              <button
                type="button"
                className={classes.figurinha}
                title={sticker.name}
                disabled={enviando === sticker.id}
                onClick={() => handleEnviar(sticker)}
              >
                <img
                  src={mediaUrl(sticker.fileName)}
                  alt={sticker.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </button>
              {podeExcluir && (
                <button
                  type="button"
                  className={classes.excluir}
                  title="Excluir figurinha"
                  onClick={e => handleExcluir(e, sticker)}
                >
                  <CloseIcon style={{ fontSize: 12 }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {podeAdicionar && (
        <div className={classes.rodape}>
          <input
            ref={inputArquivo}
            type="file"
            className={classes.oculto}
            accept="image/*,video/mp4,video/webm"
            onChange={handleArquivo}
          />
          <Button
            fullWidth
            size="small"
            startIcon={subindo ? <CircularProgress size={14} /> : <AddIcon />}
            disabled={subindo}
            onClick={() => inputArquivo.current?.click()}
          >
            {subindo ? "Convertendo…" : "Adicionar figurinha"}
          </Button>
        </div>
      )}
    </Paper>
  );
};

export default StickerPicker;
