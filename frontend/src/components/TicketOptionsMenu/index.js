import React, { useEffect, useRef, useState } from "react";

import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ConfirmationModal from "../ConfirmationModal";
import TransferTicketModal from "../TransferTicketModal";
import toastError from "../../errors/toastError";
import { Can } from "../Can";

const TicketOptionsMenu = ({ ticket, menuOpen, handleClose, anchorEl, onTransferir, onDevolver }) => {
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
	const isMounted = useRef(true);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	const handleDeleteTicket = async () => {
		try {
			await api.delete(`/tickets/${ticket.id}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleOpenConfirmationModal = e => {
		setConfirmationOpen(true);
		handleClose();
	};

	const handleOpenTransferModal = e => {
		handleClose();
		if (onTransferir) {
			onTransferir();
			return;
		}
		setTransferTicketModalOpen(true);
	};

	const handleCloseTransferTicketModal = () => {
		if (isMounted.current) {
			setTransferTicketModalOpen(false);
		}
	};

	return (
		<>
			<Menu
				id="menu-appbar"
				anchorEl={anchorEl}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				keepMounted
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				open={menuOpen}
				onClose={handleClose}
			>
				<Can permission="tickets:transfer">
					<MenuItem onClick={handleOpenTransferModal}>
						{i18n.t("ticketOptionsMenu.transfer")}
					</MenuItem>
				</Can>
				{onDevolver && (
					<MenuItem
						onClick={() => {
							handleClose();
							onDevolver();
						}}
					>
						{i18n.t("messagesList.header.buttons.return")}
					</MenuItem>
				)}
				{/* Usava a API antiga do Can (role/perform), que não existe mais:
				    o item nunca aparecia, nem para quem tem a permissão. */}
				<Can permission="tickets:delete">
					<MenuItem onClick={handleOpenConfirmationModal} sx={{ color: "error.main" }}>
						{i18n.t("ticketOptionsMenu.delete")}
					</MenuItem>
				</Can>
			</Menu>
			<ConfirmationModal
				title={`${i18n.t("ticketOptionsMenu.confirmationModal.title")}${
					ticket.id
				} ${i18n.t("ticketOptionsMenu.confirmationModal.titleFrom")} ${
					ticket.contact.name
				}?`}
				open={confirmationOpen}
				onClose={setConfirmationOpen}
				danger
				confirmLabel={i18n.t("ticketOptionsMenu.buttons.delete")}
				onConfirm={handleDeleteTicket}
			>
				{i18n.t("ticketOptionsMenu.confirmationModal.message")}
			</ConfirmationModal>
			{!onTransferir && (
			<TransferTicketModal
				modalOpen={transferTicketModalOpen}
				onClose={handleCloseTransferTicketModal}
				ticketid={ticket.id}
				ticketWhatsappId={ticket.whatsappId}
				currentQueueId={ticket.queueId}
				currentUserId={ticket.userId}
				contatoConhecido={Boolean(ticket.contact?.isKnown)}
			/>
			)}
		</>
	);
};

export default TicketOptionsMenu;
