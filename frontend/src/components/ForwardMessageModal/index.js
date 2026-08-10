import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete from '@mui/material/Autocomplete';

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ButtonWithSpinner from "../ButtonWithSpinner";
import { i18n } from "../../translate/i18n";

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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("forwardMessageModal.title")}</DialogTitle>
      <DialogContent dividers>
        <DialogContentText>
          {i18n.t("forwardMessageModal.helper")}
        </DialogContentText>
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
              variant="outlined"
              label={i18n.t("forwardMessageModal.fieldLabel")}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" variant="outlined">
          {i18n.t("forwardMessageModal.buttons.cancel")}
        </Button>
        <ButtonWithSpinner
          loading={sending}
          disabled={!selected}
          onClick={handleForward}
          color="primary"
          variant="contained"
        >
          {i18n.t("forwardMessageModal.buttons.confirm")}
        </ButtonWithSpinner>
      </DialogActions>
    </Dialog>
  );
};

export default ForwardMessageModal;
