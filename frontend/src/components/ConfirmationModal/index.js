import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

import { i18n } from "../../translate/i18n";

/**
 * Diálogo de confirmação.
 *
 * A hierarquia estava invertida: os dois botões eram `contained`, e o de
 * cancelar -- por vir primeiro e usar a cor primária -- lia como a ação
 * principal, enquanto o de confirmar ficava neutro. Numa exclusão isso é
 * pior do que feio: o botão que parece "o certo a clicar" é o que não faz
 * nada, e o que apaga dado passa despercebido.
 *
 * Agora cancelar é texto (é a saída, não a ação) e confirmar é o bloco de
 * cor cheia. Quando a ação destrói dado, `danger` pinta o confirmar de
 * vermelho -- é a única cor no sistema que significa "isto não volta".
 *
 * `confirmLabel` existe porque "Ok" não diz o que vai acontecer. Quem lê
 * "Excluir contato" sabe; quem lê "Ok" precisa ter guardado o título.
 */
const ConfirmationModal = ({
  title,
  children,
  open,
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel,
  danger = false,
}) => {
  return (
    <Dialog
      open={open}
      onClose={() => onClose(false)}
      aria-labelledby="confirm-dialog"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="confirm-dialog">{title}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2">{children}</Typography>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={() => onClose(false)}>
          {cancelLabel || i18n.t("confirmationModal.buttons.cancel")}
        </Button>
        <Button
          variant="contained"
          color={danger ? "error" : "primary"}
          onClick={() => {
            onClose(false);
            onConfirm();
          }}
        >
          {confirmLabel || i18n.t("confirmationModal.buttons.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationModal;
