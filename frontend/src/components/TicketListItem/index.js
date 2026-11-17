import React, { useState, useEffect, useRef, useContext } from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import makeStyles from '@mui/styles/makeStyles';
import ListItemButton from "@mui/material/ListItemButton";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ReplyIcon from "@mui/icons-material/ReplyOutlined";

import { i18n } from "../../translate/i18n";
import { formatWaitingTime, waitingLevel } from "../../helpers/waitingTime";
import { ticketDate } from "../../helpers/messageDate";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => {
	const c = theme.palette.unmess;
	return {
		ticket: {
			position: "relative",
			display: "flex",
			alignItems: "center",
			gap: 12,
			padding: "12px 16px",
			"&.Mui-selected": { backgroundColor: c.primariaSuave },
			"&.Mui-selected::before": {
				content: '""',
				position: "absolute",
				left: 0,
				top: 12,
				bottom: 12,
				width: 4,
				borderRadius: "0 4px 4px 0",
				backgroundColor: c.primaria,
			},
			"&:hover": { backgroundColor: c.superficie2 },
			"&.Mui-selected:hover": { backgroundColor: c.primariaSuave },
		},

		avatar: {
			width: 46,
			height: 46,
			flex: "none",
		},

		miolo: {
			flex: 1,
			minWidth: 0,
			display: "flex",
			flexDirection: "column",
		},

		linhaNome: {
			display: "flex",
			alignItems: "baseline",
			justifyContent: "space-between",
			gap: 8,
			minWidth: 0,
		},

		nome: {
			fontWeight: 600,
			fontSize: "0.97rem",
			minWidth: 0,
			color: c.texto,
		},

		hora: {
			flex: "none",
			fontSize: "0.78rem",
			color: c.textoApagado,
		},

		horaNova: {
			color: c.sinal,
			fontWeight: 700,
		},

		linhaPrevia: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
			marginTop: 2,
			minWidth: 0,
		},

		previa: {
			minWidth: 0,
			fontSize: "0.875rem",
			color: c.textoApagado,
			"& p": { margin: 0 },
		},

		previaNaoLida: {
			color: c.texto2,
			fontWeight: 500,
		},

		naoLidas: {
			flexShrink: 0,
			minWidth: 20,
			height: 20,
			padding: "0 6px",
			borderRadius: 10,
			backgroundColor: c.sinal,
			color: c.sinalTexto,
			fontSize: "0.72rem",
			fontWeight: 700,
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
		},

		meta: {
			display: "flex",
			alignItems: "center",
			gap: 8,
			marginTop: 6,
			minWidth: 0,
			fontSize: "0.78rem",
			color: c.textoApagado,
		},

		espera: {
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			fontWeight: 700,
			whiteSpace: "nowrap",
		},
		esperaOk: { color: c.sucesso },
		esperaAtencao: { color: c.atencao },
		esperaCritico: { color: c.erro },
		esperaIcone: { fontSize: "0.95rem" },

		etiqueta: {
			display: "inline-flex",
			alignItems: "center",
			gap: 5,
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},

		ponto: {
			width: 8,
			height: 8,
			borderRadius: "50%",
			flex: "none",
		},

		protocolo: {
			fontFamily: "ui-monospace, monospace",
			fontSize: "0.75rem",
			color: c.textoApagado,
		},

		atender: {
			flex: "none",
		},
	};
});

const TicketListItem = ({ ticket, mostrarProtocolo = false }) => {
	const classes = useStyles();

	// Recalcula de minuto em minuto: um contador de espera parado enganaria
	// mais do que ajudaria. Só roda enquanto houver ticket pendente na tela.
	const [agora, setAgora] = useState(() => new Date());

	useEffect(() => {
		if (ticket.status !== "pending") return undefined;
		const t = setInterval(() => setAgora(new Date()), 60000);
		return () => clearInterval(t);
	}, [ticket.status]);

	// Quantas mensagens o cliente mandou desde a última vez que alguém leu.
	const naoLidas = ticket.unreadMessages > 0 ? ticket.unreadMessages : 0;

	const espera =
		ticket.status === "pending"
			? formatWaitingTime(ticketDate(ticket), agora)
			: null;
	const nivelEspera = waitingLevel(ticketDate(ticket), agora);
	const aguardando = ticket.status === "pending" && !ticket.contact?.isKnown;
	const history = useHistory();
	const [loading, setLoading] = useState(false);
	const { ticketId } = useParams();
	const isMounted = useRef(true);
	const { user } = useContext(AuthContext);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	const handleAcepptTicket = async id => {
		setLoading(true);
		try {
			await api.put(`/tickets/${id}`, {
				status: "open",
				userId: user?.id,
			});
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
		if (isMounted.current) {
			setLoading(false);
		}
		history.push(`/tickets/${id}`);
	};

	const handleSelectTicket = id => {
		history.push(`/tickets/${id}`);
	};

	return (
		<ListItemButton
			onClick={() => handleSelectTicket(ticket.id)}
			selected={Boolean(ticketId) && +ticketId === ticket.id}
			className={classes.ticket}
		>
			<Avatar src={ticket?.contact?.profilePicUrl} className={classes.avatar} alt={ticket.contact?.name}>
				{ticket.contact?.name?.[0]?.toUpperCase()}
			</Avatar>

			<div className={classes.miolo}>
				<div className={classes.linhaNome}>
					<Typography noWrap component="span" className={classes.nome}>
						{ticket.contact.name}
					</Typography>
					<span className={clsx(classes.hora, { [classes.horaNova]: ticket.unreadMessages > 0 })}>
						{isSameDay(parseISO(ticketDate(ticket)), new Date())
							? format(parseISO(ticketDate(ticket)), "HH:mm")
							: format(parseISO(ticketDate(ticket)), "dd/MM/yy")}
					</span>
				</div>

				<div className={classes.linhaPrevia}>
					<Typography
						noWrap
						component="div"
						className={clsx(classes.previa, { [classes.previaNaoLida]: ticket.unreadMessages > 0 })}
					>
						{ticket.lastMessage ? <MarkdownWrapper>{ticket.lastMessage}</MarkdownWrapper> : " "}
					</Typography>
					{ticket.unreadMessages > 0 && !aguardando && (
						<span className={classes.naoLidas}>{ticket.unreadMessages}</span>
					)}
				</div>

				{(aguardando || mostrarProtocolo) && (
					<div className={classes.meta}>
						{aguardando && espera && (
							<span
								className={clsx(classes.espera, {
									[classes.esperaOk]: nivelEspera === "ok",
									[classes.esperaAtencao]: nivelEspera === "atencao",
									[classes.esperaCritico]: nivelEspera === "critico",
								})}
								title={i18n.t("ticketsList.waitingFor")}
							>
								<AccessTimeIcon className={classes.esperaIcone} />
								{espera === "agora" ? "Chegou agora" : `Esperando há ${espera}`}
							</span>
						)}
						{mostrarProtocolo && ticket.protocol ? (
							<span className={classes.protocolo} title={i18n.t("ticketsList.protocol")}>
								{ticket.protocol}
							</span>
						) : aguardando && ticket.queue?.name ? (
							<span className={classes.etiqueta} title="Fila">
								<span className={classes.ponto} style={{ backgroundColor: ticket.queue.color || "#9AA1AC" }} />
								{ticket.queue.name}
							</span>
						) : null}
					</div>
				)}
			</div>

			{aguardando && (
				<ButtonWithSpinner
					color="primary"
					variant="contained"
					className={classes.atender}
					size="small"
					loading={loading}
					onClick={e => {
						e.stopPropagation();
						handleAcepptTicket(ticket.id);
					}}
				>
					Atender
				</ButtonWithSpinner>
			)}
		</ListItemButton>
	);
};

export default TicketListItem;
