import React, { useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  ButtonBase,
  IconButton,
  Popover,
  Slider,
  Switch,
  Tooltip,
  Typography,
  Button,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import HeadsetIcon from "@mui/icons-material/Headset";
import HeadsetOffIcon from "@mui/icons-material/HeadsetOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import TuneIcon from "@mui/icons-material/Tune";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import SettingsInputAntennaIcon from "@mui/icons-material/SettingsInputAntenna";

import { useTeamChat, nomeDaTecla } from "../../context/TeamChat";

/**
 * Peças do rádio da equipe: o botão de falar, os controles (mudo, surdo,
 * ajustes) e o "rádio de cinto" — o painel flutuante que acompanha a pessoa
 * pelas outras telas enquanto ela está num canal.
 */

const useStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;
  return {
    botao: {
      width: "100%",
      minHeight: 56,
      borderRadius: 14,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      fontWeight: 700,
      fontSize: "0.95rem",
      userSelect: "none",
      touchAction: "none",
      WebkitTouchCallout: "none",
      border: `2px solid transparent`,
      transition: "background-color .12s, transform .08s, box-shadow .12s",
      "&:focus-visible": { boxShadow: c.foco },
    },
    livre: {
      backgroundColor: c.primaria,
      color: c.primariaTexto,
      "&:hover": { backgroundColor: c.primariaHover },
    },
    noAr: {
      backgroundColor: c.erro,
      color: theme.palette.mode === "dark" ? "#121418" : "#fff",
      transform: "scale(0.98)",
      boxShadow: `0 0 0 6px ${c.erroSuave}`,
    },
    ocupado: {
      backgroundColor: c.atencaoSuave,
      color: c.atencao,
      borderColor: c.atencao,
    },
    soEscuta: {
      backgroundColor: c.hover,
      color: c.textoApagado,
    },
    compacto: { minHeight: 44, fontSize: "0.85rem", borderRadius: 12 },
    tempo: { fontVariantNumeric: "tabular-nums", opacity: 0.85, fontWeight: 600 },
    controles: { display: "flex", alignItems: "center", gap: 2 },
    desligado: { color: c.erro },
    ajustes: { padding: 16, width: 280, display: "flex", flexDirection: "column", gap: 12 },
    linhaAjuste: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
    dock: {
      position: "fixed",
      right: 16,
      bottom: 16,
      zIndex: 1250,
      width: 300,
      borderRadius: 16,
      backgroundColor: c.superficie,
      border: `1px solid ${c.linha}`,
      boxShadow: c.sombraFlutuante,
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      [theme.breakpoints.down("sm")]: {
        left: 12,
        right: 12,
        width: "auto",
        bottom: 76,
      },
    },
    dockTopo: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
    dockNome: {
      flex: 1,
      minWidth: 0,
      fontWeight: 700,
      fontSize: "0.9rem",
      color: c.texto,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    dockStatus: {
      fontSize: "0.78rem",
      color: c.textoApagado,
      display: "flex",
      alignItems: "center",
      gap: 6,
      minHeight: 18,
    },
    antena: { color: c.sucesso, fontSize: 20 },
    pontoNoAr: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.erro,
      animation: "$pulsar 1s ease-in-out infinite",
      flexShrink: 0,
    },
    "@keyframes pulsar": {
      "0%, 100%": { opacity: 1 },
      "50%": { opacity: 0.3 },
    },
    aviso: { fontSize: "0.75rem", color: c.atencao, lineHeight: 1.3 },
    linhaControles: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  };
});

const useSegundos = (ativo) => {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    if (!ativo) {
      setSegundos(0);
      return undefined;
    }
    const inicio = Date.now();
    const timer = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 250);
    return () => clearInterval(timer);
  }, [ativo]);
  return segundos;
};

export const BotaoFalar = ({ compacto = false }) => {
  const classes = useStyles();
  const { radio, salaAtual, pttDown, pttUp, teclaPtt } = useTeamChat();
  const segundos = useSegundos(radio.euFalando);

  if (radio.estado !== "dentro") return null;

  const outro = salaAtual?.falando && !radio.euFalando ? salaAtual.falando : null;
  const soEscuta = !radio.podeFalar || radio.muted;

  let classe = classes.livre;
  let rotulo = `Aperte para falar · ${nomeDaTecla(teclaPtt)}`;
  if (radio.euFalando) {
    classe = classes.noAr;
    rotulo = "No ar — solte para ouvir";
  } else if (outro) {
    classe = classes.ocupado;
    rotulo = `${outro.name} está falando`;
  } else if (soEscuta) {
    classe = classes.soEscuta;
    rotulo = radio.muted ? "Microfone desligado" : "Só escuta";
  }

  return (
    <ButtonBase
      className={`${classes.botao} ${classe} ${compacto ? classes.compacto : ""}`}
      aria-label="Aperte e segure para falar no rádio"
      aria-pressed={radio.euFalando}
      onPointerDown={(e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // navegador sem captura de ponteiro: o pointerup ainda chega
        }
        pttDown();
      }}
      onPointerUp={pttUp}
      onPointerCancel={pttUp}
      onLostPointerCapture={pttUp}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          pttDown();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") pttUp();
      }}
    >
      {radio.euFalando ? <MicIcon /> : soEscuta ? <MicOffIcon /> : <MicIcon />}
      <span>{rotulo}</span>
      {radio.euFalando && <span className={classes.tempo}>{segundos}s / 60s</span>}
    </ButtonBase>
  );
};

const AjustesDoRadio = ({ anchorEl, onClose }) => {
  const classes = useStyles();
  const {
    volume,
    definirVolume,
    efeitoRadio,
    definirEfeitoRadio,
    teclaPtt,
    definirTeclaPtt,
  } = useTeamChat();
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    if (!gravando) return undefined;
    const capturar = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== "Escape") definirTeclaPtt(e.code);
      setGravando(false);
    };
    window.addEventListener("keydown", capturar, true);
    return () => window.removeEventListener("keydown", capturar, true);
  }, [gravando, definirTeclaPtt]);

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={() => {
        setGravando(false);
        onClose();
      }}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      transformOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <div className={classes.ajustes}>
        <div>
          <Typography variant="caption" color="text.secondary">
            Volume de quem fala
          </Typography>
          <Slider
            size="small"
            min={0}
            max={1.5}
            step={0.05}
            value={volume}
            onChange={(_e, v) => definirVolume(v)}
            aria-label="Volume do rádio"
          />
        </div>
        <div className={classes.linhaAjuste}>
          <div>
            <Typography variant="body2">Efeito de rádio</Typography>
            <Typography variant="caption" color="text.secondary">
              Voz na faixa do rádio, com bip de câmbio
            </Typography>
          </div>
          <Switch checked={efeitoRadio} onChange={(e) => definirEfeitoRadio(e.target.checked)} />
        </div>
        <div className={classes.linhaAjuste}>
          <div>
            <Typography variant="body2">Tecla de falar</Typography>
            <Typography variant="caption" color="text.secondary">
              Segure para transmitir com a aba em foco
            </Typography>
          </div>
          <Button size="small" variant="outlined" onClick={() => setGravando(true)}>
            {gravando ? "Aperte…" : nomeDaTecla(teclaPtt)}
          </Button>
        </div>
      </div>
    </Popover>
  );
};

export const ControlesDoRadio = ({ mostrarSair = true }) => {
  const classes = useStyles();
  const { radio, definirMudo, definirSurdo, sairDoRadio } = useTeamChat();
  const [ajustes, setAjustes] = useState(null);

  if (radio.estado !== "dentro") return null;

  return (
    <div className={classes.controles}>
      <Tooltip title={radio.muted ? "Ligar microfone" : "Desligar microfone"}>
        <span>
          <IconButton
            size="small"
            onClick={() => definirMudo(!radio.muted)}
            disabled={!radio.podeFalar}
            className={radio.muted ? classes.desligado : undefined}
            aria-label={radio.muted ? "Ligar microfone" : "Desligar microfone"}
          >
            {radio.muted ? <MicOffIcon fontSize="small" /> : <MicIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={radio.deaf ? "Voltar a ouvir" : "Parar de ouvir"}>
        <IconButton
          size="small"
          onClick={() => definirSurdo(!radio.deaf)}
          className={radio.deaf ? classes.desligado : undefined}
          aria-label={radio.deaf ? "Voltar a ouvir" : "Parar de ouvir"}
        >
          {radio.deaf ? <HeadsetOffIcon fontSize="small" /> : <HeadsetIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Tooltip title="Ajustes do rádio">
        <IconButton size="small" onClick={(e) => setAjustes(e.currentTarget)} aria-label="Ajustes do rádio">
          <TuneIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {mostrarSair && (
        <Tooltip title="Sair do rádio">
          <IconButton size="small" onClick={sairDoRadio} className={classes.desligado} aria-label="Sair do rádio">
            <CallEndIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <AjustesDoRadio anchorEl={ajustes} onClose={() => setAjustes(null)} />
    </div>
  );
};

export const nomeDoCanal = (canal) => {
  if (!canal) return "Canal";
  if (canal.kind === "direct") return canal.peer?.name || "Conversa";
  return `# ${canal.name}`;
};

/** Linha de estado: quem está falando, ou quantos estão na escuta. */
export const StatusDoRadio = () => {
  const classes = useStyles();
  const { radio, salaAtual } = useTeamChat();
  const falando = salaAtual?.falando;
  const membros = salaAtual?.membros?.length || 0;

  return (
    <div className={classes.dockStatus}>
      {radio.euFalando ? (
        <>
          <span className={classes.pontoNoAr} /> Você está no ar
        </>
      ) : falando ? (
        <>
          <span className={classes.pontoNoAr} /> {falando.name} está falando
        </>
      ) : (
        <>
          {membros} {membros === 1 ? "pessoa" : "pessoas"} na escuta
          {radio.deaf ? " · você não está ouvindo" : ""}
        </>
      )}
    </div>
  );
};

/**
 * O rádio de cinto. Aparece em qualquer tela enquanto a pessoa está num
 * canal, e some na tela de Equipe, onde os mesmos controles já estão no
 * cabeçalho da conversa.
 */
export const RadioDock = () => {
  const classes = useStyles();
  const { pathname } = useLocation();
  const { radio, canais, aviso } = useTeamChat() || {};

  if (!radio || radio.estado === "fora") return null;
  if (pathname.toLowerCase().startsWith("/equipe")) return null;

  const canal = canais.find((c) => c.id === radio.channelId);

  return (
    <div className={classes.dock} role="region" aria-label="Rádio da equipe">
      <div className={classes.dockTopo}>
        <SettingsInputAntennaIcon className={classes.antena} />
        <span className={classes.dockNome}>
          {radio.estado === "entrando" ? "Entrando no rádio…" : nomeDoCanal(canal)}
        </span>
        <Tooltip title="Abrir o canal">
          <IconButton size="small" component={RouterLink} to={`/equipe/${radio.channelId}`} aria-label="Abrir o canal">
            <OpenInFullIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
      {radio.estado === "dentro" && (
        <>
          <div className={classes.linhaControles}>
            <StatusDoRadio />
            <ControlesDoRadio />
          </div>
          <BotaoFalar compacto />
          {(aviso || radio.avisoMicrofone) && (
            <div className={classes.aviso}>{aviso || radio.avisoMicrofone}</div>
          )}
        </>
      )}
    </div>
  );
};
