import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import SellIcon from "@mui/icons-material/Sell";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import ConfirmationModal from "../ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  linha: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
  },

  posicao: {
    width: 22,
    textAlign: "center",
    fontWeight: 700,
    color: theme.palette.text.disabled,
    flexShrink: 0,
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

  colunas: {
    fontSize: "0.72rem",
    color: theme.palette.text.disabled,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 150,
  },

  novoQuadro: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

/**
 * Gestão dos quadros da empresa.
 *
 * A ordem aqui não é cosmética: uma coluna final sem destino explícito manda o
 * card para o quadro seguinte desta lista, e o último quadro é o que fatura a
 * venda. Mexer na ordem muda o caminho de todo card que ainda não terminou.
 */
const BoardsModal = ({ open, onClose, boards, onChange }) => {
  const classes = useStyles();

  const [lista, setLista] = useState([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState("#2576d2");
  const [excluindo, setExcluindo] = useState(null);

  useEffect(() => {
    if (open) setLista(boards || []);
  }, [open, boards]);

  const handleCriar = async () => {
    if (!novoNome.trim()) return;

    try {
      await api.post("/boards", { name: novoNome.trim(), color: novaCor });
      setNovoNome("");
      setNovaCor("#2576d2");
      toast.success(i18n.t("crm.toasts.boardCreated"));
      onChange();
    } catch (err) {
      toastError(err);
    }
  };

  const handleSalvar = async (board, dados) => {
    try {
      await api.put(`/boards/${board.id}`, dados);
      onChange();
    } catch (err) {
      toastError(err);
      setLista(boards || []);
    }
  };

  const handleExcluir = async (boardId) => {
    try {
      await api.delete(`/boards/${boardId}`);
      toast.success(i18n.t("crm.toasts.boardDeleted"));
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

    setLista(reordenada);

    try {
      await api.put("/boards/reorder", {
        boardIds: reordenada.map((board) => board.id),
      });
      onChange();
    } catch (err) {
      toastError(err);
      setLista(boards || []);
    }
  };

  const alterarLocal = (boardId, campos) => {
    setLista((prev) =>
      prev.map((board) =>
        board.id === boardId ? { ...board, ...campos } : board
      )
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <ConfirmationModal
        title={i18n.t("crm.boardsModal.deleteTitle")}
        open={Boolean(excluindo)}
        onClose={() => setExcluindo(null)}
        onConfirm={() => handleExcluir(excluindo.id)}
      >
        {i18n.t("crm.boardsModal.deleteMessage")}
      </ConfirmationModal>

      <DialogTitle>{i18n.t("crm.boardsModal.title")}</DialogTitle>

      <DialogContent dividers>
        <DialogContentText style={{ fontSize: "0.8rem" }}>
          {i18n.t("crm.boardsModal.help")}
        </DialogContentText>

        {lista.map((board, indice) => (
          <div key={board.id} className={classes.linha}>
            <span className={classes.posicao}>{indice + 1}</span>

            <input
              type="color"
              className={classes.cor}
              value={board.color || "#2576d2"}
              onChange={(e) => alterarLocal(board.id, { color: e.target.value })}
              onBlur={(e) => handleSalvar(board, { color: e.target.value })}
            />

            <TextField
              size="small"
              variant="outlined"
              value={board.name}
              style={{ flex: 1 }}
              onChange={(e) => alterarLocal(board.id, { name: e.target.value })}
              onBlur={(e) => {
                const nome = e.target.value.trim();
                const original = boards.find((b) => b.id === board.id);
                if (nome && nome !== original?.name) {
                  handleSalvar(board, { name: nome });
                }
              }}
            />

            {/* Só um quadro é o funil de vendas: é dele que sai a pergunta
                "gerar pedido?". Marcar outro desmarca este, e quem cuida disso
                é o backend. */}
            <Tooltip
              title={
                board.isSalesFunnel
                  ? "Este é o funil de vendas"
                  : "Marcar como funil de vendas"
              }
              arrow
            >
              <span>
                <IconButton
                  size="small"
                  onClick={() =>
                    !board.isSalesFunnel && handleSalvar(board, { isSalesFunnel: true })
                  }
                  style={{ color: board.isSalesFunnel ? "#1a7a55" : undefined }}
                >
                  <SellIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip
              title={(board.stages || []).map((s) => s.name).join(" · ")}
              arrow
            >
              <span className={classes.colunas}>
                {i18n.t("crm.boardsModal.columns", {
                  count: (board.stages || []).length,
                })}
              </span>
            </Tooltip>

            <Tooltip title={i18n.t("crm.boardsModal.moveUp")} arrow>
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

            <Tooltip title={i18n.t("crm.boardsModal.moveDown")} arrow>
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
              <IconButton size="small" onClick={() => setExcluindo(board)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ))}

        {lista.length > 0 && (
          <Typography
            variant="caption"
            color="textSecondary"
            style={{ display: "block", marginTop: 8 }}
          >
            {i18n.t("crm.boardsModal.lastBoardNote", {
              board: lista[lista.length - 1].name,
            })}
          </Typography>
        )}

        <div className={classes.novoQuadro}>
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
            label={i18n.t("crm.boardsModal.newBoard")}
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCriar();
            }}
          />

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

export default BoardsModal;
