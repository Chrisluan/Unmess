import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Checkbox from "@mui/material/Checkbox";
import Radio from "@mui/material/Radio";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import ConfirmationModal from "../ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  coluna: {
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },

  linha: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },

  destino: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(1),
    paddingLeft: theme.spacing(6),
    borderTop: `1px dashed ${theme.palette.divider}`,
  },

  cor: {
    width: 40,
    height: 36,
    padding: 2,
    border: "none",
    background: "none",
    cursor: "pointer",
    flexShrink: 0,
  },

  marcador: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    lineHeight: 1,
  },

  marcadorRotulo: {
    fontSize: "0.6rem",
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: theme.palette.text.disabled,
  },

  novaColuna: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

const TIPOS = ["open", "lost"];

/**
 * Configuração das colunas de um quadro.
 *
 * Cada coluna carrega dois papéis independentes: a entrada (onde pousa o card
 * que chega de outro quadro, uma só por quadro) e a saída (conclui o quadro e
 * manda o card adiante, quantas o processo exigir). Cada saída tem seu próprio
 * destino, que é o que permite "Ganho" ir para Produção enquanto "Revenda"
 * pula direto para Expedição.
 *
 * A ordem é alterada por setas em vez de arrastar: o modal já vive sobre um
 * board com drag-and-drop, e dois alvos de arraste sobrepostos confundem mais
 * do que ajudam.
 */
const PipelineStagesModal = ({ open, onClose, board, boards, onChange }) => {
  const classes = useStyles();

  const [lista, setLista] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState("open");
  const [novaCor, setNovaCor] = useState("#0b5cff");
  const [excluindo, setExcluindo] = useState(null);

  useEffect(() => {
    if (open) setLista([...(board?.stages || [])].sort((a, b) => a.order - b.order));
  }, [open, board]);

  // Quadros que podem receber card desta coluna — o próprio não entra, já que
  // mandar o card de volta para casa seria andar em círculo.
  const destinos = useMemo(
    () => (boards || []).filter((item) => item.id !== board?.id),
    [boards, board]
  );

  const salvar = async (stage, dados) => {
    try {
      await api.put(`/pipeline-stages/${stage.id}`, dados);
      onChange();
    } catch (err) {
      toastError(err);
      setLista([...(board?.stages || [])].sort((a, b) => a.order - b.order));
    }
  };

  const alterarLocal = (stageId, campos) => {
    setLista((prev) =>
      prev.map((stage) =>
        stage.id === stageId ? { ...stage, ...campos } : stage
      )
    );
  };

  const handleCriar = async () => {
    if (!novoNome.trim() || !board) return;

    try {
      await api.post("/pipeline-stages", {
        name: novoNome.trim(),
        color: novaCor,
        type: novoTipo,
        boardId: board.id,
      });
      setNovoNome("");
      setNovaCor("#0b5cff");
      setNovoTipo("open");
      toast.success(i18n.t("crm.toasts.stageCreated"));
      onChange();
    } catch (err) {
      toastError(err);
    }
  };

  const handleExcluir = async (stageId) => {
    try {
      await api.delete(`/pipeline-stages/${stageId}`);
      toast.success(i18n.t("crm.toasts.stageDeleted"));
      onChange();
    } catch (err) {
      toastError(err);
    }
    setExcluindo(null);
  };

  const handleMover = async (indice, direcao) => {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= lista.length) return;

    const reordenada = [...lista];
    [reordenada[indice], reordenada[alvo]] = [
      reordenada[alvo],
      reordenada[indice],
    ];

    // Aplica na hora e confirma com o servidor: a lista é curta e esperar o
    // round-trip a cada clique de seta deixaria a reordenação truncada.
    setLista(reordenada);

    try {
      await api.put("/pipeline-stages/reorder", {
        boardId: board.id,
        stageIds: reordenada.map((stage) => stage.id),
      });
      onChange();
    } catch (err) {
      toastError(err);
      setLista([...(board?.stages || [])].sort((a, b) => a.order - b.order));
    }
  };

  // Marcar entrada é exclusivo: o backend desmarca a anterior, e a tela
  // acompanha para não mostrar duas entradas por um instante.
  const handleEntrada = (stage) => {
    setLista((prev) =>
      prev.map((item) => ({ ...item, isInitial: item.id === stage.id }))
    );
    salvar(stage, { isInitial: true });
  };

  const handleFinal = (stage, marcado) => {
    alterarLocal(stage.id, { isFinal: marcado });
    salvar(stage, { isFinal: marcado });
  };

  const handleDestinoQuadro = (stage, boardId) => {
    // Trocar o quadro invalida a coluna escolhida antes; limpar evita apontar
    // para uma coluna que não pertence ao novo destino.
    alterarLocal(stage.id, { targetBoardId: boardId, targetStageId: null });
    salvar(stage, { targetBoardId: boardId || null, targetStageId: null });
  };

  const handleDestinoColuna = (stage, stageId) => {
    alterarLocal(stage.id, { targetStageId: stageId });
    salvar(stage, { targetStageId: stageId || null });
  };

  const colunasDoDestino = (stage) => {
    const alvo = destinos.find((item) => item.id === stage.targetBoardId);
    return [...(alvo?.stages || [])].sort((a, b) => a.order - b.order);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <ConfirmationModal
        title={i18n.t("crm.stagesModal.deleteTitle")}
        open={Boolean(excluindo)}
        onClose={() => setExcluindo(null)}
        danger
        confirmLabel="Excluir etapa"
        onConfirm={() => handleExcluir(excluindo.id)}
      >
        {i18n.t("crm.stagesModal.deleteMessage")}
      </ConfirmationModal>

      <DialogTitle>
        {i18n.t("crm.stagesModal.title")}
        {board ? ` — ${board.name}` : ""}
      </DialogTitle>

      <DialogContent dividers>
        <DialogContentText style={{ fontSize: "0.8rem" }}>
          {i18n.t("crm.stagesModal.help")}
        </DialogContentText>

        {lista.map((stage, indice) => (
          <Paper key={stage.id} variant="outlined" className={classes.coluna}>
            <div className={classes.linha}>
              <input
                type="color"
                className={classes.cor}
                value={stage.color || "#0b5cff"}
                onChange={(e) => alterarLocal(stage.id, { color: e.target.value })}
                onBlur={(e) => salvar(stage, { color: e.target.value })}
              />

              <TextField
                size="small"
                variant="outlined"
                value={stage.name}
                style={{ flex: 1, minWidth: 120 }}
                onChange={(e) => alterarLocal(stage.id, { name: e.target.value })}
                onBlur={(e) => {
                  const nome = e.target.value.trim();
                  const original = board?.stages?.find((s) => s.id === stage.id);
                  if (nome && nome !== original?.name) {
                    salvar(stage, { name: nome });
                  }
                }}
              />

              <TextField
                select
                size="small"
                variant="outlined"
                value={stage.type}
                style={{ minWidth: 100 }}
                onChange={(e) => {
                  alterarLocal(stage.id, { type: e.target.value });
                  salvar(stage, { type: e.target.value });
                }}
              >
                {TIPOS.map((tipo) => (
                  <MenuItem key={tipo} value={tipo}>
                    {i18n.t(`crm.stageType.${tipo}`)}
                  </MenuItem>
                ))}
              </TextField>

              <Tooltip title={i18n.t("crm.stagesModal.initialHelp")} arrow>
                <div className={classes.marcador}>
                  <span className={classes.marcadorRotulo}>
                    {i18n.t("crm.stagesModal.initial")}
                  </span>
                  <Radio
                    size="small"
                    checked={Boolean(stage.isInitial)}
                    onChange={() => handleEntrada(stage)}
                  />
                </div>
              </Tooltip>

              <Tooltip title={i18n.t("crm.stagesModal.finalHelp")} arrow>
                <div className={classes.marcador}>
                  <span className={classes.marcadorRotulo}>
                    {i18n.t("crm.stagesModal.final")}
                  </span>
                  <Checkbox
                    size="small"
                    checked={Boolean(stage.isFinal)}
                    disabled={stage.type === "lost"}
                    onChange={(e) => handleFinal(stage, e.target.checked)}
                  />
                </div>
              </Tooltip>

              {/* Probabilidade alimenta a previsao do funil: 10 mil numa etapa de
                  70% valem 7 mil no que se espera fechar. */}
              <Tooltip title="Chance de fechamento nesta etapa (%)" arrow>
                <TextField
                  size="small"
                  type="number"
                  label="%"
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  value={stage.probability ?? 0}
                  onChange={(e) =>
                    alterarLocal(stage.id, { probability: e.target.value })
                  }
                  onBlur={(e) =>
                    salvar(stage, {
                      probability: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                    })
                  }
                  inputProps={{ min: 0, max: 100 }}
                  style={{ width: 74 }}
                />
              </Tooltip>

              {/* Ganho explicito: antes so era possivel faturar chegando ao fim
                  do ultimo quadro, o que impedia uma coluna de ganho no meio. */}
              <Tooltip title="Nesta etapa a venda e considerada ganha" arrow>
                <div className={classes.marcador}>
                  <span className={classes.marcadorRotulo}>GANHO</span>
                  <Checkbox
                    size="small"
                    checked={Boolean(stage.isWon)}
                    disabled={stage.type === "lost"}
                    onChange={(e) => salvar(stage, { isWon: e.target.checked })}
                  />
                </div>
              </Tooltip>

              {/* Desativar em vez de excluir: a coluna some do quadro mas quem
                  passou por ela mantem o historico coerente. */}
              <Tooltip title="Coluna ativa no quadro" arrow>
                <div className={classes.marcador}>
                  <span className={classes.marcadorRotulo}>ATIVA</span>
                  <Checkbox
                    size="small"
                    checked={stage.active !== false}
                    onChange={(e) => salvar(stage, { active: e.target.checked })}
                  />
                </div>
              </Tooltip>

              <Tooltip title={i18n.t("crm.stagesModal.moveUp")} arrow>
                <span>
                  <IconButton
                    size="small"
                    disabled={indice === 0}
                    onClick={() => handleMover(indice, -1)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={i18n.t("crm.stagesModal.moveDown")} arrow>
                <span>
                  <IconButton
                    size="small"
                    disabled={indice === lista.length - 1}
                    onClick={() => handleMover(indice, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={i18n.t("crm.buttons.delete")} arrow>
                <IconButton size="small" onClick={() => setExcluindo(stage)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>

            {stage.isFinal && (
              <div className={classes.destino}>
                <Typography variant="caption" color="textSecondary">
                  {i18n.t("crm.stagesModal.sendTo")}
                </Typography>

                <TextField
                  select
                  size="small"
                  variant="outlined"
                  value={stage.targetBoardId || ""}
                  style={{ minWidth: 170 }}
                  label={i18n.t("crm.stagesModal.targetBoard")}
                  onChange={(e) => handleDestinoQuadro(stage, e.target.value)}
                >
                  <MenuItem value="">
                    {i18n.t("crm.stagesModal.nextInLine")}
                  </MenuItem>
                  {destinos.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  size="small"
                  variant="outlined"
                  value={stage.targetStageId || ""}
                  style={{ minWidth: 170 }}
                  disabled={!stage.targetBoardId}
                  label={i18n.t("crm.stagesModal.targetStage")}
                  onChange={(e) => handleDestinoColuna(stage, e.target.value)}
                >
                  <MenuItem value="">
                    {i18n.t("crm.stagesModal.entryColumn")}
                  </MenuItem>
                  {colunasDoDestino(stage).map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </TextField>
              </div>
            )}
          </Paper>
        ))}

        <div className={classes.novaColuna}>
          <input
            type="color"
            className={classes.cor}
            value={novaCor}
            onChange={(e) => setNovaCor(e.target.value)}
          />

          <TextField
            size="small"
            variant="outlined"
            style={{ flex: 1 }}
            label={i18n.t("crm.stagesModal.newStage")}
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCriar();
            }}
          />

          <TextField
            select
            size="small"
            variant="outlined"
            value={novoTipo}
            style={{ minWidth: 100 }}
            onChange={(e) => setNovoTipo(e.target.value)}
          >
            {TIPOS.map((tipo) => (
              <MenuItem key={tipo} value={tipo}>
                {i18n.t(`crm.stageType.${tipo}`)}
              </MenuItem>
            ))}
          </TextField>

          <Button
            variant="contained"
            color="primary"
            disabled={!novoNome.trim()}
            onClick={handleCriar}
          >
            {i18n.t("crm.buttons.add")}
          </Button>
        </div>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          {i18n.t("crm.buttons.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PipelineStagesModal;
