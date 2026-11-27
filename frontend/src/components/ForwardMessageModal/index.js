import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete from "@mui/material/Autocomplete";
import ShortcutIcon from "@mui/icons-material/Shortcut";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import Janela from "../Janela";

/**
 * Encaminhar mensagem: escolhe o contato de destino e reenvia o conteúdo.
 * Se o contato já tiver um chat aberto/pendente, ele é reaproveitado.
 */
const ForwardMessageModal = ({ open, onClose, message }) => {
  const history = useHistory();

  const [searchParam, setSearchParam] = useState("");
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchParam("");
      setSelected(null);
      setOptions([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || searchParam.length < 3) {
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("contacts", { params: { searchParam } });
        setOptions(data.contacts || []);
      } catch (err) {
        toastError(err);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchParam, open]);

  const handleForward = async () => {
    if (!selected) return;

    setSending(true);
    try {
      const { data } = await api.post(`/messages/${message.id}/forward`, {
        toContactId: selected.id,
      });
      toast.success(i18n.t("forwardMessageModal.success"));
      onClose();
      if (data?.ticketId) {
        history.push(`/tickets/${data.ticketId}`);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Janela
      open={open}
      onClose={onClose}
      icone={<ShortcutIcon />}
      titulo={i18n.t("forwardMessageModal.title")}
      subtitulo={i18n.t("forwardMessageModal.helper")}
      tamanho="xs"
      rotuloCancelar={i18n.t("forwardMessageModal.buttons.cancel")}
      rotuloConfirmar={
        selected
          ? `Encaminhar para ${String(selected.name || "").split(" ")[0]}`
          : i18n.t("forwardMessageModal.buttons.confirm")
      }
      onConfirmar={handleForward}
      confirmarDesabilitado={!selected}
      carregando={sending}
    >
      <Autocomplete
        options={options}
        loading={searching}
        value={selected}
        onChange={(e, value) => setSelected(value)}
        getOptionLabel={(option) => `${option.name} - ${option.number}`}
        isOptionEqualToValue={(option, value) => option.id === value?.id}
        noOptionsText={i18n.t("forwardMessageModal.noOptions")}
        renderInput={(params) => (
          <TextField
            {...params}
            autoFocus
            size="small"
            variant="outlined"
            placeholder={i18n.t("forwardMessageModal.fieldLabel")}
            onChange={(e) => setSearchParam(e.target.value)}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {searching ? <CircularProgress size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    </Janela>
  );
};

export default ForwardMessageModal;
