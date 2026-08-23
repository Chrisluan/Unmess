import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";

import { Button, Chip, Divider, Paper, Typography } from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import { format, parseISO } from "date-fns";

import api from "../../services/api";
import CustomerModal from "../CustomerModal";
import StatusChip from "../StatusChip";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	section: {
		marginTop: 8,
		padding: 8,
		display: "flex",
		flexDirection: "column",
	},
	row: {
		display: "flex",
		justifyContent: "space-between",
		gap: 8,
		padding: "2px 0",
	},
	label: {
		color: theme.palette.text.secondary,
		fontSize: "0.78rem",
	},
	value: {
		fontSize: "0.82rem",
		textAlign: "right",
		wordBreak: "break-word",
	},
	historyItem: {
		padding: "6px 4px",
		cursor: "pointer",
		"&:hover": { backgroundColor: theme.palette.action.hover },
	},

	statusBase: {
		borderColor: "currentColor",
		fontWeight: 700,
	},
	statusLead: { color: theme.palette.warning.main },
	statusAtivo: { color: theme.palette.success.main },
	statusInativo: { color: theme.palette.text.secondary },
	empty: {
		fontSize: "0.8rem",
		color: theme.palette.text.secondary,
		padding: "4px 0",
	},
}));

const STATUS_CLASSE = {
	lead: "statusLead",
	active: "statusAtivo",
	inactive: "statusInativo",
};

/**
 * Bloco de cliente + histórico dentro do painel lateral do chat.
 * Antes o atendente precisava sair da conversa e abrir o módulo Clientes
 * para ver CNPJ, segmento ou responsável.
 */
const CustomerPanel = ({ contact }) => {
	const classes = useStyles();
	const history = useHistory();

	const [customer, setCustomer] = useState(null);
	const [tickets, setTickets] = useState([]);
	const [modalOpen, setModalOpen] = useState(false);

	const fetchCustomer = useCallback(async () => {
		if (!contact?.id) return;
		try {
			const { data } = await api.get(`/customers/by-contact/${contact.id}`);
			setCustomer(data || null);
		} catch {
			setCustomer(null);
		}
	}, [contact?.id]);

	const fetchTickets = useCallback(async () => {
		if (!contact?.id) return;
		try {
			const { data } = await api.get(`/contacts/${contact.id}/tickets`);
			setTickets(Array.isArray(data) ? data : []);
		} catch {
			setTickets([]);
		}
	}, [contact?.id]);

	useEffect(() => {
		fetchCustomer();
		fetchTickets();
	}, [fetchCustomer, fetchTickets]);

	const renderRow = (label, value) => {
		if (!value) return null;
		return (
			<div className={classes.row}>
				<span className={classes.label}>{label}</span>
				<span className={classes.value}>{value}</span>
			</div>
		);
	};

	return (
		<>
			<CustomerModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				customerId={customer?.id}
				// Ao criar pelo chat já vem vinculado ao contato e com os dados
				// que o WhatsApp entregou — evita redigitação.
				initialValues={
					customer
						? undefined
						: {
								name: contact?.name || "",
								whatsapp: contact?.number || "",
								email: contact?.email || "",
								contactId: contact?.id,
						  }
				}
				onSave={fetchCustomer}
			/>

			<Paper square variant="outlined" className={classes.section}>
				<Typography variant="subtitle2">
					{i18n.t("contactDrawer.customer.title")}
				</Typography>
				<Divider />

				{customer ? (
					<>
						<div className={classes.row}>
							<span className={classes.label}>
								{i18n.t("contactDrawer.customer.status")}
							</span>
							<Chip
								size="small"
								variant="outlined"
								label={i18n.t(`contactDrawer.customer.statuses.${customer.status}`)}
								className={`${classes.statusBase} ${
									classes[STATUS_CLASSE[customer.status]] || classes.statusInativo
								}`}
							/>
						</div>
						{renderRow(i18n.t("contactDrawer.customer.name"), customer.name)}
						{renderRow(
							i18n.t("contactDrawer.customer.document"),
							customer.document
						)}
						{renderRow(
							i18n.t("contactDrawer.customer.segment"),
							customer.segment
						)}
						{renderRow(
							i18n.t("contactDrawer.customer.responsible"),
							customer.responsibleUser?.name
						)}
						{renderRow(
							i18n.t("contactDrawer.customer.city"),
							[customer.city, customer.state].filter(Boolean).join(" / ")
						)}
						{customer.notes && (
							<>
								<span className={classes.label} style={{ marginTop: 6 }}>
									{i18n.t("contactDrawer.customer.notes")}
								</span>
								<span className={classes.value} style={{ textAlign: "left" }}>
									{customer.notes}
								</span>
							</>
						)}
						<Button
							size="small"
							color="primary"
							variant="outlined"
							style={{ marginTop: 8 }}
							onClick={() => setModalOpen(true)}
						>
							{i18n.t("contactDrawer.customer.edit")}
						</Button>
					</>
				) : (
					<>
						<span className={classes.empty}>
							{i18n.t("contactDrawer.customer.notLinked")}
						</span>
						<Button
							size="small"
							color="primary"
							variant="contained"
							onClick={() => setModalOpen(true)}
						>
							{i18n.t("contactDrawer.customer.create")}
						</Button>
					</>
				)}
			</Paper>

			<Paper square variant="outlined" className={classes.section}>
				<Typography variant="subtitle2">
					{i18n.t("contactDrawer.history.title")}
				</Typography>
				<Divider />
				{tickets.length === 0 && (
					<span className={classes.empty}>
						{i18n.t("contactDrawer.history.empty")}
					</span>
				)}
				{tickets.map(ticket => (
					<div
						key={ticket.id}
						className={classes.historyItem}
						role="button"
						tabIndex={0}
						title={i18n.t("contactDrawer.history.open")}
						onClick={() => history.push(`/tickets/${ticket.id}`)}
						onKeyDown={e => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								history.push(`/tickets/${ticket.id}`);
							}
						}}
					>
						<div className={classes.row}>
							<span className={classes.value} style={{ textAlign: "left" }}>
								{ticket.protocol || `#${ticket.id}`}
								{ticket.queue?.name ? ` · ${ticket.queue.name}` : ""}
							</span>
							<span className={classes.label}>
								{format(parseISO(ticket.createdAt), "dd/MM/yy")}
							</span>
						</div>
						<div className={classes.row}>
							<span className={classes.label}>
								{ticket.user?.name || i18n.t("contactDrawer.history.noAgent")}
							</span>
							{ticket.closingStatus?.name ? (
								<Chip
									size="small"
									label={ticket.closingStatus.name}
									style={{
										backgroundColor: ticket.closingStatus.color || "#95a5a6",
										color: "#fff",
										height: 18,
										fontSize: "0.68rem",
									}}
								/>
							) : (
								<StatusChip status={ticket.status} />
							)}
						</div>
					</div>
				))}
			</Paper>
		</>
	);
};

export default CustomerPanel;
