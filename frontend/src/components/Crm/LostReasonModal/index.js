import React, { useState, useEffect } from "react";

import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

import api from "../../../services/api";
import { i18n } from "../../../translate/i18n";

/**
 * Pergunta o motivo quando um card vai parar numa coluna de perda.
 *
 * Vale para qualquer caminho: arrastar direto para a coluna de perda, ou cair
 * nela por transferência de outro quadro -- é o caso de "Encerrado" no
 * Financeiro, configurado para devolver o card a "Perdido" em Vendas. Antes
 * esse segundo caminho não perguntava nada, e a perda entrava muda no
 * relatório.
 *
 * A lista pronta existe porque motivo digitado vira relatório inútil: "caro",
 * "achou caro" e "preço alto" são a mesma coisa contada três vezes. O campo de
 * complemento fica junto, para o que não couber na categoria.
 *
 * Agora o motivo é obrigatório -- o backend recusa a perda sem ele.
 */
const LostReasonModal = ({ open, dealTitle, onClose, onConfirm }) => {
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [motivos, setMotivos] = useState([]);

  useEffect(() => {
    if (!open) return;
    setMotivo("");
    setDetalhe("");
  }, [open]);

  // O catálogo vem do backend, que é quem valida: duas listas divergiriam.
  useEffect(() => {
    let ativo = true;
    api
      .get("/motivos-de-perda")
      .then(({ data }) => ativo && setMotivos(data.motivos || []))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  // "Outro" sem explicação não diz nada — aí o complemento passa a ser exigido.
  const precisaDetalhe = motivo === "outro";
  const podeConfirmar = motivo && (!precisaDetalhe || detalhe.trim());

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("crm.lostModal.title")}</DialogTitle>

      <DialogContent>
        <DialogContentText>
          {i18n.t("crm.lostModal.message", { title: dealTitle || "" })}
        </DialogContentText>

        <TextField
          select
          fullWidth
          autoFocus
          margin="dense"
          variant="outlined"
          label="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          SelectProps={{ native: true }}
          InputLabelProps={{ shrink: true }}
        >
          <option value="">Selecione…</option>
          {motivos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </TextField>

        <TextField
          fullWidth
          multiline
          rows={2}
          margin="dense"
          variant="outlined"
          label={precisaDetalhe ? "Qual motivo?" : "Complemento (opcional)"}
          placeholder="O que mais ajuda a entender essa perda"
          value={detalhe}
          onChange={(e) => setDetalhe(e.target.value)}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="secondary" variant="outlined">
          {i18n.t("crm.buttons.cancel")}
        </Button>
        <Button
          onClick={() => onConfirm(motivo, detalhe.trim())}
          color="primary"
          variant="contained"
          disabled={!podeConfirmar}
        >
          {i18n.t("crm.lostModal.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LostReasonModal;
