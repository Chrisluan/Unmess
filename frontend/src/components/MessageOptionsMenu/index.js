import React, { useState, useContext } from "react";

import MenuItem from "@mui/material/MenuItem";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ConfirmationModal from "../ConfirmationModal";
import { Menu } from "@mui/material";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";
import ForwardMessageModal from "../ForwardMessageModal";
import EditMessageModal from "../EditMessageModal";
import usePermissions from "../../hooks/usePermissions";
import { toast } from "react-toastify";

const MessageOptionsMenu = ({ message, menuOpen, handleClose, anchorEl }) => {
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const { can } = usePermissions();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const handleDeleteMessage = async () => {
    try {
      await api.delete(`/messages/${message.id}`);
    } catch (err) {
      toastError(err);
    }
  };

  const hanldeReplyMessage = () => {
    setReplyingMessage(message);
    handleClose();
  };

  const handleOpenConfirmationModal = (e) => {
    setConfirmationOpen(true);
    handleClose();
  };

  const handleOpenForward = () => {
    setForwardOpen(true);
    handleClose();
  };

  const handleOpenEdit = () => {
    setEditOpen(true);
    handleClose();
  };

  // O WhatsApp só aceita reescrever mensagem própria, de texto e recente.
  // Anexo não dá para trocar, e nota interna nunca saiu daqui.
  const podeEditar =
    message.fromMe &&
    !message.isDeleted &&
    !message.isInternal &&
    !message.mediaUrl;

  /**
   * Guarda na biblioteca uma figurinha que apareceu na conversa.
   *
   * O nome do arquivo entra na condição junto com o mediaType porque as
   * mensagens recebidas antes da correção no backend ficaram gravadas como
   * "image" -- sem isso, justamente as figurinhas já recebidas não poderiam
   * ser salvas.
   */
  const ehFigurinha =
    message.mediaType === "sticker" ||
    /(^|\/)sticker-/i.test(message.mediaUrl || "");

  const podeSalvarFigurinha =
    ehFigurinha && !message.isDeleted && can("stickers:create");

  const handleSalvarFigurinha = async () => {
    handleClose();

    const nome = window.prompt("Nome para guardar esta figurinha:");
    if (!nome?.trim()) return;

    try {
      await api.post(`/stickers/from-message/${message.id}`, { name: nome.trim() });
      toast.success("Figurinha guardada na biblioteca.");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <>
      <ForwardMessageModal
        open={forwardOpen}
        onClose={() => setForwardOpen(false)}
        message={message}
      />
      <EditMessageModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        message={message}
      />
      <ConfirmationModal
        title={i18n.t("messageOptionsMenu.confirmationModal.title")}
        open={confirmationOpen}
        onClose={setConfirmationOpen}
        onConfirm={handleDeleteMessage}
      >
        {i18n.t("messageOptionsMenu.confirmationModal.message")}
      </ConfirmationModal>
      <Menu
        anchorEl={anchorEl}
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={menuOpen}
        onClose={handleClose}
      >
        {podeEditar && (
          <MenuItem onClick={handleOpenEdit}>
            {i18n.t("messageOptionsMenu.edit")}
          </MenuItem>
        )}
        {message.fromMe && (
          <MenuItem onClick={handleOpenConfirmationModal}>
            {i18n.t("messageOptionsMenu.delete")}
          </MenuItem>
        )}
        <MenuItem onClick={hanldeReplyMessage}>
          {i18n.t("messageOptionsMenu.reply")}
        </MenuItem>
        {podeSalvarFigurinha && (
          <MenuItem onClick={handleSalvarFigurinha}>
            Salvar figurinha
          </MenuItem>
        )}
        {/* Nota interna não sai do sistema — não faz sentido encaminhar. */}
        {!message.isInternal && !message.isDeleted && (
          <MenuItem onClick={handleOpenForward}>
            {i18n.t("messageOptionsMenu.forward")}
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default MessageOptionsMenu;
