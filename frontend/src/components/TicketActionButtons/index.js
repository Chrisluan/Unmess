import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";

import makeStyles from "@mui/styles/makeStyles";
import { IconButton, Tooltip } from "@mui/material";
import { MoreVert, Replay, CheckCircleOutline, Undo } from "@mui/icons-material";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import CloseTicketModal from "../CloseTicketModal";

const useStyles = makeStyles((theme) => ({
	actionButtons: {
		marginRight: 6,
		flex: "none",
		alignSelf: "center",
		marginLeft: "auto",
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
	},
}));

/**
 * Ações da conversa aberta.
 *
 * Havia dois botões lado a lado com o mesmo peso visual e rótulos que não
 * diziam o que ia acontecer: "Retornar" (para onde?) e "Resolver" (que abria
 * um diálogo chamado "Encerrar chat"). Agora o rótulo do botão e o título do
 * diálogo que ele abre são a mesma palavra, a ação de sair da conversa é
 * secundária -- ela devolve trabalho para a fila, não conclui nada -- e cada
 * botão tem uma dica dizendo a consequência.
 */
const TicketActionButtons = ({ ticket }) => {
	const classes = useStyles();
	const history = useHistory();
	const [anchorEl, setAnchorEl] = useState(null);
	const [loading, setLoading] = useState(false);
	const ticketOptionsMenuOpen = Boolean(anchorEl);
	const { user } = useContext(AuthContext);
	const [closeModalOpen, setCloseModalOpen] = useState(false);

	const handleOpenTicketOptionsMenu = (e) => {
		setAnchorEl(e.currentTarget);
	};

	const handleCloseTicketOptionsMenu = () => {
		setAnchorEl(null);
	};

	const handleUpdateTicketStatus = async (e, status, userId, closingStatusId) => {
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

	return (
		<div className={classes.actionButtons}>
			<CloseTicketModal
				open={closeModalOpen}
				loading={loading}
				onClose={() => setCloseModalOpen(false)}
				onConfirm={(closingStatusId) =>
					handleUpdateTicketStatus(null, "closed", user?.id, closingStatusId)
				}
			/>

			{ticket.status === "closed" && (
				<Tooltip title={i18n.t("messagesList.header.tooltips.reopen")} arrow>
					<span>
						<ButtonWithSpinner
							loading={loading}
							startIcon={<Replay />}
							variant="contained"
							color="primary"
							size="small"
							onClick={(e) => handleUpdateTicketStatus(e, "open", user?.id)}
						>
							{i18n.t("messagesList.header.buttons.reopen")}
						</ButtonWithSpinner>
					</span>
				</Tooltip>
			)}

			{ticket.status === "open" && (
				<>
					{/* Devolver à fila não faz sentido para conhecido: ele não
					    passa por fila nem tem dono. */}
					{!ticket.contact?.isKnown && (
						<Tooltip title={i18n.t("messagesList.header.tooltips.return")} arrow>
							<span>
								<ButtonWithSpinner
									loading={loading}
									startIcon={<Undo />}
									variant="outlined"
									color="inherit"
									size="small"
									onClick={(e) => handleUpdateTicketStatus(e, "pending", null)}
								>
									{i18n.t("messagesList.header.buttons.return")}
								</ButtonWithSpinner>
							</span>
						</Tooltip>
					)}
					<Tooltip title={i18n.t("messagesList.header.tooltips.resolve")} arrow>
						<span>
							<ButtonWithSpinner
								loading={loading}
								startIcon={<CheckCircleOutline />}
								size="small"
								variant="contained"
								color="primary"
								onClick={() => setCloseModalOpen(true)}
							>
								{i18n.t("messagesList.header.buttons.resolve")}
							</ButtonWithSpinner>
						</span>
					</Tooltip>
					<Tooltip title={i18n.t("messagesList.header.tooltips.more")} arrow>
						<IconButton
							onClick={handleOpenTicketOptionsMenu}
							aria-label={i18n.t("messagesList.header.tooltips.more")}
							size="small"
						>
							<MoreVert />
						</IconButton>
					</Tooltip>
					<TicketOptionsMenu
						ticket={ticket}
						anchorEl={anchorEl}
						menuOpen={ticketOptionsMenuOpen}
						handleClose={handleCloseTicketOptionsMenu}
					/>
				</>
			)}

			{ticket.status === "pending" && !ticket.contact?.isKnown && (
				<Tooltip title={i18n.t("messagesList.header.tooltips.accept")} arrow>
					<span>
						<ButtonWithSpinner
							loading={loading}
							size="small"
							variant="contained"
							color="primary"
							onClick={(e) => handleUpdateTicketStatus(e, "open", user?.id)}
						>
							{i18n.t("messagesList.header.buttons.accept")}
						</ButtonWithSpinner>
					</span>
				</Tooltip>
			)}
		</div>
	);
};

export default TicketActionButtons;
