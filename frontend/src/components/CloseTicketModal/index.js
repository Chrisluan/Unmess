import React, { useContext, useEffect, useState } from "react";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContentText from "@mui/material/DialogContentText";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ButtonWithSpinner from "../ButtonWithSpinner";
import { i18n } from "../../translate/i18n";
import { AttendanceSettingsContext } from "../../context/Settings/AttendanceSettingsContext";

/**
 * Pergunta o motivo de encerramento antes de finalizar o chat.
 * Obrigatório ou não conforme Configurações › Geral › "Exigir status ao encerrar".
 */
const CloseTicketModal = ({ open, onClose, onConfirm, loading }) => {
  const { isEnabled } = useContext(AttendanceSettingsContext);
  const [statuses, setStatuses] = useState([]);
  const [selected, setSelected] = useState("");
  const [fetching, setFetching] = useState(false);

  const required = isEnabled("requireClosingStatus");

  useEffect(() => {
    if (!open) return;

    const fetchStatuses = async () => {
      setFetching(true);
      try {
        const { data } = await api.get("/ticket-statuses");
        setStatuses(Array.isArray(data) ? data : data?.ticketStatuses ?? []);
      } catch (err) {
        toastError(err);
      } finally {
        setFetching(false);
      }
    };

    fetchStatuses();
  }, [open]);

  useEffect(() => {
    if (!open) setSelected("");
  }, [open]);

  const handleConfirm = () => {
    onConfirm(selected || null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{i18n.t("closeTicketModal.title")}</DialogTitle>
      <DialogContent dividers>
        <DialogContentText>
          {required
            ? i18n.t("closeTicketModal.requiredHelper")
            : i18n.t("closeTicketModal.optionalHelper")}
        </DialogContentText>
        <FormControl variant="outlined" margin="dense" fullWidth>
          <InputLabel id="closing-status-label">
            {i18n.t("closeTicketModal.status")}
          </InputLabel>
          <Select
            labelId="closing-status-label"
            label={i18n.t("closeTicketModal.status")}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={fetching}
          >
            {!required && (
              <MenuItem value="">
                <em>{i18n.t("closeTicketModal.none")}</em>
              </MenuItem>
            )}
            {statuses.map((status) => (
              <MenuItem key={status.id} value={status.id}>
                <Chip
                  size="small"
                  label={status.name}
                  style={{
                    backgroundColor: status.color || "#bdc3c7",
                    color: "#fff",
                    marginRight: 8,
                  }}
                />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {statuses.length === 0 && !fetching && (
          <DialogContentText variant="caption" color="error">
            {i18n.t("closeTicketModal.noStatuses")}
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" variant="outlined">
          {i18n.t("closeTicketModal.buttons.cancel")}
        </Button>
        <ButtonWithSpinner
          loading={loading}
          disabled={required && !selected}
          onClick={handleConfirm}
          color="primary"
          variant="contained"
        >
          {i18n.t("closeTicketModal.buttons.confirm")}
        </ButtonWithSpinner>
      </DialogActions>
    </Dialog>
  );
};

export default CloseTicketModal;
