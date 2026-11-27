import React from "react";
import Typography from "@mui/material/Typography";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmberRounded";

import { i18n } from "../../translate/i18n";
import Janela from "../Janela";

/**
 * Diálogo de confirmação, sobre a Janela padrão.
 *
 * Cancelar é texto (é a saída, não a ação) e confirmar é o bloco de cor
 * cheia. Quando a ação destrói dado, `danger` pinta ícone e botão de
 * vermelho -- é a única cor no sistema que significa "isto não volta".
 *
 * `confirmLabel` existe porque "Ok" não diz o que vai acontecer. Quem lê
 * "Excluir contato" sabe; quem lê "Ok" precisa ter guardado o título.
 *
 * A interface é a mesma de antes (title, open, onClose, onConfirm,
 * confirmLabel, cancelLabel, danger): as vinte telas que usam continuam
 * iguais e ganham o visual novo.
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
  icon,
}) => {
  const fechar = () => onClose(false);

  return (
    <Janela
      open={open}
      onClose={fechar}
      titulo={title}
      tom={danger ? "perigo" : "padrao"}
      icone={icon || (danger ? <WarningAmberIcon /> : <HelpOutlineIcon />)}
      tamanho="xs"
      rotuloCancelar={cancelLabel || i18n.t("confirmationModal.buttons.cancel")}
      rotuloConfirmar={confirmLabel || i18n.t("confirmationModal.buttons.confirm")}
      onConfirmar={() => {
        fechar();
        onConfirm();
      }}
    >
      {children ? (
        <Typography variant="body2" component="div" color="text.secondary">
          {children}
        </Typography>
      ) : null}
    </Janela>
  );
};

export default ConfirmationModal;
