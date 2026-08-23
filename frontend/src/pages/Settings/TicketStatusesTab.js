import React, { useEffect, useState } from "react";

import {
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    Button,
    Chip,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import { DeleteOutline, Edit, Add } from "@mui/icons-material";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n.js";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../../components/ConfirmationModal";
import TicketStatusModal from "../../components/TicketStatusModal";

const useStyles = makeStyles(theme => ({
	paper: {
		padding: theme.spacing(2),
	},
	addButton: {
		marginBottom: theme.spacing(2),
	},
}));

const TicketStatusesTab = () => {
	const classes = useStyles();
	const [statuses, setStatuses] = useState([]);
	const [modalOpen, setModalOpen] = useState(false);
	const [selectedStatus, setSelectedStatus] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);

	const fetchStatuses = async () => {
		try {
			const { data } = await api.get("/ticket-statuses");
			setStatuses(data);
		} catch (err) {
			toastError(err);
		}
	};

	useEffect(() => {
		fetchStatuses();
	}, []);

	const handleOpenModal = () => {
		setSelectedStatus(null);
		setModalOpen(true);
	};

	const handleCloseModal = () => {
		setSelectedStatus(null);
		setModalOpen(false);
		fetchStatuses();
	};

	const handleEdit = status => {
		setSelectedStatus(status);
		setModalOpen(true);
	};

	const handleDelete = async statusId => {
		try {
			await api.delete(`/ticket-statuses/${statusId}`);
			toast.success(i18n.t("settings.ticketStatuses.toasts.deleted"));
			fetchStatuses();
		} catch (err) {
			toastError(err);
		}
		setSelectedStatus(null);
	};

	return (
		<Paper className={classes.paper} variant="outlined">
			<ConfirmationModal
				title={
					selectedStatus &&
					`${i18n.t("settings.ticketStatuses.confirmationModal.deleteTitle")} ${
						selectedStatus.name
					}?`
				}
				open={confirmModalOpen}
				onClose={() => setConfirmModalOpen(false)}
				danger
				confirmLabel="Excluir status"
				onConfirm={() => handleDelete(selectedStatus.id)}
			>
				{i18n.t("settings.ticketStatuses.confirmationModal.deleteMessage")}
			</ConfirmationModal>
			<TicketStatusModal
				open={modalOpen}
				onClose={handleCloseModal}
				ticketStatus={selectedStatus}
			/>
			<Button
				className={classes.addButton}
				variant="contained"
				color="primary"
				startIcon={<Add />}
				onClick={handleOpenModal}
			>
				{i18n.t("settings.ticketStatuses.buttons.add")}
			</Button>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>{i18n.t("settings.ticketStatuses.table.name")}</TableCell>
						<TableCell align="center">
							{i18n.t("settings.ticketStatuses.table.type")}
						</TableCell>
						<TableCell align="center">
							{i18n.t("settings.ticketStatuses.table.default")}
						</TableCell>
						<TableCell align="center">
							{i18n.t("settings.ticketStatuses.table.actions")}
						</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{statuses.map(status => (
						<TableRow key={status.id}>
							<TableCell>
								<Chip
									label={status.name}
									size="small"
									style={{
										backgroundColor: status.color || "#666",
										color: "#fff",
									}}
								/>
							</TableCell>
							<TableCell align="center">
								{i18n.t(`settings.ticketStatuses.types.${status.type}`)}
							</TableCell>
							<TableCell align="center">
								{status.isDefault
									? i18n.t("settings.ticketStatuses.yes")
									: i18n.t("settings.ticketStatuses.no")}
							</TableCell>
							<TableCell align="center">
								<IconButton size="small" onClick={() => handleEdit(status)}>
									<Edit />
								</IconButton>
								<IconButton
									size="small"
									onClick={() => {
										setSelectedStatus(status);
										setConfirmModalOpen(true);
									}}
								>
									<DeleteOutline />
								</IconButton>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Paper>
	);
};

export default TicketStatusesTab;
