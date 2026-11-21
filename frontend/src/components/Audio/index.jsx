import React, { useCallback, useEffect, useRef, useState } from "react";

import makeStyles from "@mui/styles/makeStyles";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Tooltip from "@mui/material/Tooltip";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import DownloadIcon from "@mui/icons-material/FileDownloadOutlined";

import { i18n } from "../../translate/i18n";

const LS_NAME = "audioMessageRate";
const VELOCIDADES = [1, 1.5, 2, 0.5];

/**
 * Player das mensagens de voz.
 *
 * O controle nativo do navegador mudava de cara em cada um deles, ocupava a
 * largura toda do balão e escondia a velocidade atrás de um menu de contexto —
 * quando existia. Aqui os mesmos comandos aparecem sempre do mesmo jeito, com
 * a duração e o progresso à vista e alvos grandes o bastante para o toque.
 */
const useStyles = makeStyles(theme => ({
  raiz: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "min(280px, 60vw)",
    padding: "2px 0",
  },

  botaoTocar: {
    flexShrink: 0,
    color: "inherit",
    backgroundColor: theme.palette.action.hover,
    "&:hover": { backgroundColor: theme.palette.action.selected },
  },

  trilha: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },

  barra: {
    padding: "6px 0 !important",
    color: "currentColor",
    "& .MuiSlider-thumb": {
      width: 10,
      height: 10,
      // O ponteiro só cresce quando alguém está mexendo: parado, ele compete
      // com o texto da mensagem ao lado.
      transition: "width .15s, height .15s",
      "&:hover, &.Mui-active": { width: 14, height: 14 },
    },
    "& .MuiSlider-rail": { opacity: 0.3 },
  },

  tempos: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.68rem",
    opacity: 0.75,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },

  velocidade: {
    flexShrink: 0,
    minWidth: 34,
    fontSize: "0.7rem",
    fontWeight: 600,
    color: "inherit",
    padding: "4px 6px",
  },

  baixar: {
    flexShrink: 0,
    color: "inherit",
    opacity: 0.7,
  },
}));

const formatarTempo = segundos => {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";

  const inteiros = Math.floor(segundos);
  const minutos = Math.floor(inteiros / 60);
  const resto = inteiros % 60;

  return `${minutos}:${String(resto).padStart(2, "0")}`;
};

const lerVelocidadeSalva = () => {
  try {
    const salva = parseFloat(localStorage.getItem(LS_NAME) || "1");
    return VELOCIDADES.includes(salva) ? salva : 1;
  } catch {
    return 1;
  }
};

export default function Audio({ url }) {
  const classes = useStyles();
  const audioRef = useRef(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [velocidade, setVelocidade] = useState(lerVelocidadeSalva);
  // Enquanto o dedo está no ponteiro, o tempo do áudio não manda na posição
  // mostrada: senão a barra pula de volta a cada quadro.
  const arrastando = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const aoCarregar = () => {
      // Áudio do WhatsApp vem em Ogg/Opus sem tamanho declarado, e o Chrome
      // responde Infinity até o arquivo terminar de ser lido. Sem esta
      // guarda, a duração aparecia como "Infinity:NaN".
      setDuracao(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const aoAndar = () => {
      if (!arrastando.current) setPosicao(audio.currentTime);
    };
    const aoTerminar = () => {
      setTocando(false);
      setPosicao(0);
      audio.currentTime = 0;
    };

    const aoTocar = () => setTocando(true);
    const aoPausar = () => setTocando(false);

    audio.addEventListener("loadedmetadata", aoCarregar);
    audio.addEventListener("durationchange", aoCarregar);
    audio.addEventListener("timeupdate", aoAndar);
    audio.addEventListener("play", aoTocar);
    audio.addEventListener("pause", aoPausar);
    audio.addEventListener("ended", aoTerminar);

    return () => {
      audio.removeEventListener("loadedmetadata", aoCarregar);
      audio.removeEventListener("durationchange", aoCarregar);
      audio.removeEventListener("timeupdate", aoAndar);
      audio.removeEventListener("play", aoTocar);
      audio.removeEventListener("pause", aoPausar);
      audio.removeEventListener("ended", aoTerminar);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = velocidade;

    try {
      localStorage.setItem(LS_NAME, String(velocidade));
    } catch {
      // Armazenamento bloqueado: a velocidade vale só nesta sessão.
    }
  }, [velocidade]);

  const alternar = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch(() => setTocando(false));
    } else {
      audio.pause();
    }
  }, []);

  const trocarVelocidade = () => {
    const atual = VELOCIDADES.indexOf(velocidade);
    setVelocidade(VELOCIDADES[(atual + 1) % VELOCIDADES.length]);
  };

  const mover = (_, valor) => {
    arrastando.current = true;
    setPosicao(valor);
  };

  const soltar = (_, valor) => {
    arrastando.current = false;
    if (audioRef.current) audioRef.current.currentTime = valor;
  };

  return (
    <div className={classes.raiz}>
      {/* Sem type declarado: o navegador detecta pelo conteúdo. Fixar
          "audio/ogg" fazia ele descartar a fonte sem tentar quando o arquivo
          era mp3, webm ou m4a — formatos que também chegam aqui, do WhatsApp
          e da gravação do painel. */}
      <audio ref={audioRef} src={url} preload="metadata" />

      <Tooltip
        title={i18n.t(tocando ? "audioPlayer.pause" : "audioPlayer.play")}
        arrow
      >
        <IconButton
          size="small"
          className={classes.botaoTocar}
          onClick={alternar}
          aria-label={i18n.t(
            tocando ? "audioPlayer.pause" : "audioPlayer.play"
          )}
        >
          {tocando ? (
            <PauseIcon fontSize="small" />
          ) : (
            <PlayArrowIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>

      <div className={classes.trilha}>
        <Slider
          className={classes.barra}
          size="small"
          value={posicao}
          min={0}
          max={duracao || Math.max(posicao, 1)}
          step={0.1}
          onChange={mover}
          onChangeCommitted={soltar}
          aria-label={i18n.t("audioPlayer.position")}
        />
        <span className={classes.tempos}>
          <span>{formatarTempo(posicao)}</span>
          <span>{duracao ? formatarTempo(duracao) : "--:--"}</span>
        </span>
      </div>

      <Tooltip title={i18n.t("audioPlayer.speed")} arrow>
        <IconButton
          size="small"
          className={classes.velocidade}
          onClick={trocarVelocidade}
          aria-label={i18n.t("audioPlayer.speed")}
        >
          {velocidade}x
        </IconButton>
      </Tooltip>

      <Tooltip title={i18n.t("audioPlayer.download")} arrow>
        <IconButton
          size="small"
          className={classes.baixar}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={i18n.t("audioPlayer.download")}
        >
          <DownloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </div>
  );
}
