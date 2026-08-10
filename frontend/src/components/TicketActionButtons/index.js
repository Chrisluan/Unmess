import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";

import makeStyles from '@mui/styles/makeStyles';
import { IconButton } from "@mui/material";
import { MoreVert, Replay } from "@mui/icons-material";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import CloseTicketModal from "../CloseTicketModal";

const useStyles = makeStyles(theme => ({
	actionButtons: {
		marginRight: 6,
		flex: "none",
		alignSelf: "center",
		marginLeft: "auto",
		"& > *": {
			margin: theme.spacing(1),
		},
	},
}));

const TicketActionButtons = ({ ticket }) => {
	const classes = useStyles();
	const history = useHistory();
	const [anchorEl, setAnchorEl] = useState(null);
	const [loading, setLoading] = useState(false);
	const ticketOptionsMenuOpen = Boolean(anchorEl);
	const { user } = useContext(AuthContext);
	const [closeModalOpen, setCloseModalOpen] = useState(false);

	const handleOpenTicketOptionsMenu = e => {
		setAnchorEl(e.currentTarget);
	};

	const handleCloseTicketOptionsMenu = e => {
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
				onConfirm={closingStatusId =>
					handleUpdateTicketStatus(null, "closed", user?.id, closingStatusId)
				}
			/>
            {ticket.status === "closed" && (
				<ButtonWithSpinner
					loading={loading}
					startIcon={<Replay />}
					size="small"
					onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
				>
					{i18n.t("messagesList.header.buttons.reopen")}
				</ButtonWithSpinner>
			)}
            {ticket.status === "open" && (
				<>
					{/* Devolver à fila não faz sentido para conhecido: ele não
					    passa por fila nem tem dono. */}
					{!ticket.contact?.isKnown && (
						<ButtonWithSpinner
							loading={loading}
							startIcon={<Replay />}
							size="small"
							onClick={e => handleUpdateTicketStatus(e, "pending", null)}
						>
							{i18n.t("messagesList.header.buttons.return")}
						</ButtonWithSpinner>
					)}
					<ButtonWithSpinner
						loading={loading}
						size="small"
						variant="contained"
						color="primary"
						onClick={() => setCloseModalOpen(true)}
					>
						{i18n.t("messagesList.header.buttons.resolve")}
					</ButtonWithSpinner>
					<IconButton onClick={handleOpenTicketOptionsMenu} size="large">
						<MoreVert />
					</IconButton>
					<TicketOptionsMenu
						ticket={ticket}
						anchorEl={anchorEl}
						menuOpen={ticketOptionsMenuOpen}
						handleClose={handleCloseTicketOptionsMenu}
					/>
				</>
			)}
            {ticket.status === "pending" && !ticket.contact?.isKnown && (
				<ButtonWithSpinner
					loading={loading}
					size="small"
					variant="contained"
					color="primary"
					onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
				>
					{i18n.t("messagesList.header.buttons.accept")}
				</ButtonWithSpinner>
			)}
        </div>
    );
};

export default TicketActionButtons;
