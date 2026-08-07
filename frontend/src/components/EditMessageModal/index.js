import React, { useState, useEffect } from "react";

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@material-ui/core";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const EditMessageModal = ({ open, onClose, message }) => {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setBody(message?.body ?? "");
  }, [open, message]);

  const handleSave = async () => {
    const texto = body.trim();
    if (!texto || texto === message?.body) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await api.put(`/messages/${message.id}`, { body: texto });
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{i18n.t("editMessageModal.title")}</DialogTitle>
      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          multiline
          rows={4}
          variant="outlined"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          label={i18n.t("editMessageModal.field")}
          helperText={i18n.t("editMessageModal.timeLimit")}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" disabled={saving}>
          {i18n.t("editMessageModal.buttons.cancel")}
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={saving || !body.trim()}
        >
          {i18n.t("editMessageModal.buttons.save")}
          {saving && <CircularProgress size={16} style={{ marginLeft: 8 }} />}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditMessageModal;
