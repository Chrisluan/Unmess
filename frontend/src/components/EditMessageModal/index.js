import React, { useState, useEffect } from "react";

import TextField from "@mui/material/TextField";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import Janela from "../Janela";

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
    <Janela
      open={open}
      onClose={onClose}
      icone={<EditOutlinedIcon />}
      titulo={i18n.t("editMessageModal.title")}
      subtitulo={i18n.t("editMessageModal.timeLimit")}
      tamanho="sm"
      rotuloCancelar={i18n.t("editMessageModal.buttons.cancel")}
      rotuloConfirmar={i18n.t("editMessageModal.buttons.save")}
      onConfirmar={handleSave}
      confirmarDesabilitado={!body.trim()}
      carregando={saving}
    >
      <TextField
        autoFocus
        fullWidth
        multiline
        minRows={3}
        maxRows={10}
        variant="outlined"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        label={i18n.t("editMessageModal.field")}
        onKeyDown={(e) => {
          // Ctrl+Enter salva, como no campo de mensagem.
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSave();
          }
        }}
      />
    </Janela>
  );
};

export default EditMessageModal;
