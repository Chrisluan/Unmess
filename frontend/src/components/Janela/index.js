import React from "react";

import makeStyles from "@mui/styles/makeStyles";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import ButtonWithSpinner from "../ButtonWithSpinner";

/**
 * A janela padrão do sistema.
 *
 * Cada modal montava o próprio cabeçalho, o próprio rodapé e a própria ordem
 * de botões: em um o cancelar era verde e contornado, em outro era texto; um
 * tinha X para fechar, outro não; uns explicavam o que ia acontecer, outros
 * só mostravam campos. Quem usa aprendia cada janela de novo.
 *
 * Aqui a estrutura é sempre a mesma:
 *
 *   ┌──────────────────────────────────────────┐
 *   │ [ícone]  Título                       ✕  │
 *   │          Uma frase do que acontece       │
 *   ├──────────────────────────────────────────┤
 *   │  conteúdo                                │
 *   ├──────────────────────────────────────────┤
 *   │              Cancelar   [ Ação clara ]   │
 *   └──────────────────────────────────────────┘
 *
 *  - o botão principal diz o que faz ("Transferir para Ana", não "Ok");
 *  - cancelar é texto: é a saída, não uma ação;
 *  - `tom="perigo"` pinta ícone e botão de vermelho, para o que não volta;
 *  - com `onSubmit` a janela vira formulário e o Enter confirma;
 *  - no celular ocupa a tela e os botões dividem a largura.
 */

const useStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;

  return {
    cabecalho: {
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
      padding: "18px 16px 14px 24px",
      [theme.breakpoints.down("sm")]: { padding: "14px 10px 12px 16px" },
    },

    icone: {
      width: 40,
      height: 40,
      borderRadius: 12,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      "& svg": { fontSize: 22 },
    },

    iconePadrao: { background: c.primariaSuave, color: c.primariaSuaveTexto },
    iconePerigo: { background: c.erroSuave, color: c.erro },
    iconeAtencao: { background: c.atencaoSuave, color: c.atencao },
    iconeSucesso: { background: c.sucessoSuave, color: c.sucesso },

    textos: { flex: 1, minWidth: 0, paddingTop: 1 },

    titulo: {
      fontSize: "1.0625rem",
      fontWeight: 700,
      letterSpacing: "-0.01em",
      lineHeight: 1.3,
      color: c.texto,
    },

    subtitulo: {
      marginTop: 3,
      fontSize: "0.8125rem",
      lineHeight: 1.45,
      color: c.textoApagado,
    },

    fechar: { marginTop: -4, flexShrink: 0 },

    corpo: {
      padding: "4px 24px 20px",
      [theme.breakpoints.down("sm")]: { padding: "4px 16px 16px" },
    },

    corpoSemRespiro: { padding: 0 },

    rodape: {
      [theme.breakpoints.down("sm")]: {
        padding: "10px 12px",
        "& > *": { flex: 1 },
      },
    },

    rodapeEsquerda: { marginRight: "auto !important" },
  };
});

const CLASSE_DO_TOM = {
  padrao: "iconePadrao",
  perigo: "iconePerigo",
  atencao: "iconeAtencao",
  sucesso: "iconeSucesso",
};

const Janela = ({
  open,
  onClose,
  titulo,
  subtitulo,
  icone,
  tom = "padrao",
  tamanho = "sm",
  children,

  // Botão principal. `rotuloConfirmar` deve dizer o que acontece.
  rotuloConfirmar,
  onConfirmar,
  confirmarDesabilitado = false,
  carregando = false,

  rotuloCancelar = "Cancelar",
  semCancelar = false,

  // Ação extra, à esquerda do rodapé (ex.: "Só concluir", "Remover").
  acaoExtra,

  // Rodapé próprio, para os casos que não cabem no padrão.
  rodape,
  semRodape = false,

  // Com onSubmit o conteúdo vira <form> e o principal é type="submit".
  onSubmit,

  semRespiro = false,
  telaCheiaNoCelular = true,
  fecharAoClicarFora = true,
  dialogProps = {},
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const celular = useMediaQuery(theme.breakpoints.down("sm"));

  const fechar = (_evento, motivo) => {
    if (carregando) return;
    if (motivo === "backdropClick" && !fecharAoClicarFora) return;
    if (onClose) onClose();
  };

  const corpo = (
    <>
      <div className={classes.cabecalho}>
        {icone && (
          <div className={`${classes.icone} ${classes[CLASSE_DO_TOM[tom]]}`}>
            {icone}
          </div>
        )}

        <div className={classes.textos}>
          <Typography component="h2" id="janela-titulo" className={classes.titulo}>
            {titulo}
          </Typography>
          {subtitulo && (
            <Typography component="div" className={classes.subtitulo}>
              {subtitulo}
            </Typography>
          )}
        </div>

        {onClose && (
          <IconButton
            size="small"
            className={classes.fechar}
            onClick={fechar}
            disabled={carregando}
            aria-label="Fechar"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </div>

      {children !== undefined && children !== null && children !== false && (
        <DialogContent
          className={`${classes.corpo} ${semRespiro ? classes.corpoSemRespiro : ""}`}
        >
          {children}
        </DialogContent>
      )}

      {!semRodape &&
        (rodape || (
          <DialogActions className={classes.rodape}>
            {acaoExtra && (
              <Button
                color="inherit"
                className={celular ? undefined : classes.rodapeEsquerda}
                onClick={acaoExtra.onClick}
                disabled={carregando || acaoExtra.desabilitado}
                startIcon={acaoExtra.icone}
              >
                {acaoExtra.rotulo}
              </Button>
            )}

            {!semCancelar && (
              <Button color="inherit" onClick={fechar} disabled={carregando}>
                {rotuloCancelar}
              </Button>
            )}

            {rotuloConfirmar && (
              <ButtonWithSpinner
                variant="contained"
                color={tom === "perigo" ? "error" : "primary"}
                type={onSubmit ? "submit" : "button"}
                onClick={onSubmit ? undefined : onConfirmar}
                loading={carregando}
                // O ButtonWithSpinner deixa `disabled` sobrescrever `loading`:
                // sem juntar os dois, o botão destravava no meio do envio.
                disabled={carregando || confirmarDesabilitado}
              >
                {rotuloConfirmar}
              </ButtonWithSpinner>
            )}
          </DialogActions>
        ))}
    </>
  );

  return (
    <Dialog
      open={Boolean(open)}
      onClose={fechar}
      maxWidth={tamanho}
      fullWidth
      fullScreen={telaCheiaNoCelular && celular && tamanho !== "xs"}
      scroll="paper"
      aria-labelledby="janela-titulo"
      {...dialogProps}
    >
      {onSubmit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!carregando && !confirmarDesabilitado) onSubmit(e);
          }}
          style={{ display: "contents" }}
        >
          {corpo}
        </form>
      ) : (
        corpo
      )}
    </Dialog>
  );
};

/**
 * Um bloco de campos com rótulo curto e ajuda opcional — o "passo" dentro de
 * uma janela. Deixa a leitura em degraus: o que escolher, depois o detalhe.
 */
const useSecaoStyles = makeStyles((theme) => ({
  secao: {
    "& + &": { marginTop: 20 },
  },
  rotulo: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: theme.palette.unmess.textoApagado,
    marginBottom: 8,
  },
  ajuda: {
    fontSize: "0.8125rem",
    color: theme.palette.unmess.textoApagado,
    marginTop: 6,
    lineHeight: 1.45,
  },
}));

export const SecaoDaJanela = ({ rotulo, extra, ajuda, children, className }) => {
  const classes = useSecaoStyles();
  return (
    <div className={`${classes.secao} ${className || ""}`}>
      {rotulo && (
        <div className={classes.rotulo}>
          <span>{rotulo}</span>
          {extra}
        </div>
      )}
      {children}
      {ajuda && <div className={classes.ajuda}>{ajuda}</div>}
    </div>
  );
};

/**
 * Opção grande e clicável, no lugar de um rádio miúdo: título, uma linha do
 * que acontece e, se marcada, a borda na cor primária.
 */
const useOpcaoStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;
  return {
    opcao: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      width: "100%",
      textAlign: "left",
      padding: "12px 14px",
      borderRadius: 12,
      border: `1px solid ${c.linhaForte}`,
      background: c.superficie,
      color: c.texto,
      cursor: "pointer",
      font: "inherit",
      transition: "border-color 120ms, background-color 120ms, box-shadow 120ms",
      "&:hover": { background: c.superficie2 },
      "&:focus-visible": { outline: "none", boxShadow: c.foco },
      "&:disabled": { cursor: "not-allowed", opacity: 0.55 },
    },
    marcada: {
      borderColor: c.primaria,
      background: c.primariaSuave,
      boxShadow: `inset 0 0 0 1px ${c.primaria}`,
      "&:hover": { background: c.primariaSuave },
    },
    icone: {
      width: 34,
      height: 34,
      borderRadius: 10,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: c.hover,
      color: c.texto2,
      "& svg": { fontSize: 20 },
    },
    iconeMarcada: { background: c.primaria, color: c.primariaTexto },
    textos: { flex: 1, minWidth: 0 },
    titulo: { fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.3 },
    descricao: {
      fontSize: "0.78rem",
      color: c.textoApagado,
      lineHeight: 1.4,
      marginTop: 2,
    },
  };
});

export const OpcaoDaJanela = ({
  marcada,
  onClick,
  icone,
  titulo,
  descricao,
  disabled,
  extra,
}) => {
  const classes = useOpcaoStyles();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={Boolean(marcada)}
      className={`${classes.opcao} ${marcada ? classes.marcada : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icone && (
        <span className={`${classes.icone} ${marcada ? classes.iconeMarcada : ""}`}>
          {icone}
        </span>
      )}
      <span className={classes.textos}>
        <span className={classes.titulo} style={{ display: "block" }}>
          {titulo}
        </span>
        {descricao && (
          <span className={classes.descricao} style={{ display: "block" }}>
            {descricao}
          </span>
        )}
      </span>
      {extra}
    </button>
  );
};

export default Janela;
