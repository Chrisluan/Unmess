import React, { useState, useEffect } from "react";

import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

import { i18n } from "../../../translate/i18n";

/**
 * Pergunta o motivo ao mover um negócio para uma etapa de perda.
 *
 * O motivo é opcional — travar o movimento por causa dele faria a pessoa
 * inventar texto só para conseguir arrastar o card.
 */
const LostReasonModal = ({ open, dealTitle, onClose, onConfirm }) => {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("crm.lostModal.title")}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {i18n.t("crm.lostModal.message", { title: dealTitle || "" })}
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          multiline
          rows={3}
          margin="dense"
          variant="outlined"
          label={i18n.t("crm.lostModal.reason")}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" variant="outlined">
          {i18n.t("crm.buttons.cancel")}
        </Button>
        <Button
          onClick={() => onConfirm(motivo)}
          color="primary"
          variant="contained"
        >
          {i18n.t("crm.lostModal.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LostReasonModal;
