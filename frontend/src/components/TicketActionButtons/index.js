import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";

import makeStyles from '@mui/styles/makeStyles';
import { Button, IconButton, Tooltip } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ReplayIcon from "@mui/icons-material/Replay";
import CheckIcon from "@mui/icons-material/Check";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ViewSidebarOutlinedIcon from "@mui/icons-material/ViewSidebarOutlined";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import TransferTicketModal from "../TransferTicketModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import CloseTicketModal from "../CloseTicketModal";

const useStyles = makeStyles(theme => ({
	actionButtons: {
		flex: "none",
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
	},
	soLargo: {
		[theme.breakpoints.down("sm")]: { display: "none !important" },
	},
	painelAtivo: {
		backgroundColor: theme.palette.unmess.primariaSuave,
		color: theme.palette.unmess.primariaSuaveTexto,
		"&:hover": { backgroundColor: theme.palette.unmess.primariaSuave },
	},
}));

const TicketActionButtons = ({ ticket, painelAberto, onTogglePainel, children }) => {
	const classes = useStyles();
	const history = useHistory();
	const [anchorEl, setAnchorEl] = useState(null);
	const [loading, setLoading] = useState(false);
	const [transferirAberto, setTransferirAberto] = useState(false);
	const { user } = useContext(AuthContext);
	const [closeModalOpen, setCloseModalOpen] = useState(false);

	const handleUpdateTicketStatus = async (status, userId, closingStatusId) => {
		setLoading(true);
		try {
			await api.put(`/tickets/${ticket.id}`, {
				status: status,
				userId: userId || null,
				...(closingStatusId ? { closingStatusId } : {}),
			});

			setLoading(false);
			setCloseModalOpen(false);
			if (status === "open") {
				history.push(`/tickets/${ticket.id}`);
			} else {
				history.push("/tickets");
			}
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
	};

	const podeDevolver = ticket.status === "open" && !ticket.contact?.isKnown;

	return (
		<div className={classes.actionButtons}>
			<CloseTicketModal
				open={closeModalOpen}
				loading={loading}
				onClose={() => setCloseModalOpen(false)}
				onConfirm={closingStatusId => handleUpdateTicketStatus("closed", user?.id, closingStatusId)}
			/>
			{ticket.id && (
				<TransferTicketModal
					modalOpen={transferirAberto}
					onClose={() => setTransferirAberto(false)}
					ticketid={ticket.id}
					ticketWhatsappId={ticket.whatsappId}
					currentQueueId={ticket.queueId}
					currentUserId={ticket.userId}
				/>
			)}

			{children}

			{ticket.status === "closed" && (
				<ButtonWithSpinner
					loading={loading}
					variant="outlined"
					startIcon={<ReplayIcon />}
					onClick={() => handleUpdateTicketStatus("open", user?.id)}
				>
					{i18n.t("messagesList.header.buttons.reopen")}
				</ButtonWithSpinner>
			)}

			{ticket.status === "open" && (
				<>
					<Button
						variant="outlined"
						startIcon={<SwapHorizIcon />}
						className={classes.soLargo}
						onClick={() => setTransferirAberto(true)}
					>
						{i18n.t("ticketOptionsMenu.transfer")}
					</Button>
					<Tooltip title="Encerrar a conversa">
						<span>
							<ButtonWithSpinner
								loading={loading}
								variant="contained"
								color="primary"
								startIcon={<CheckIcon />}
								onClick={() => setCloseModalOpen(true)}
							>
								{i18n.t("messagesList.header.buttons.resolve")}
							</ButtonWithSpinner>
						</span>
					</Tooltip>
				</>
			)}

			{ticket.status === "pending" && !ticket.contact?.isKnown && (
				<ButtonWithSpinner
					loading={loading}
					variant="contained"
					color="primary"
					onClick={() => handleUpdateTicketStatus("open", user?.id)}
				>
					Atender
				</ButtonWithSpinner>
			)}

			{onTogglePainel && (
				<Tooltip title={painelAberto ? "Esconder detalhes do cliente" : "Mostrar detalhes do cliente"}>
					<IconButton
						onClick={onTogglePainel}
						className={`${classes.soLargo} ${painelAberto ? classes.painelAtivo : ""}`}
						aria-pressed={Boolean(painelAberto)}
						aria-label="Detalhes do cliente"
					>
						<ViewSidebarOutlinedIcon />
					</IconButton>
				</Tooltip>
			)}

			{ticket.status === "open" && (
				<>
					<Tooltip title="Mais ações">
						<IconButton onClick={e => setAnchorEl(e.currentTarget)} aria-label="Mais ações">
							<MoreVertIcon />
						</IconButton>
					</Tooltip>
					<TicketOptionsMenu
						ticket={ticket}
						anchorEl={anchorEl}
						menuOpen={Boolean(anchorEl)}
						handleClose={() => setAnchorEl(null)}
						onTransferir={() => setTransferirAberto(true)}
						onDevolver={podeDevolver ? () => handleUpdateTicketStatus("pending", null) : null}
					/>
				</>
			)}
		</div>
	);
};

export default TicketActionButtons;
