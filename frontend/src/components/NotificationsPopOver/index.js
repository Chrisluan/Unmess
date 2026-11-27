import React, { useState, useRef, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import { format } from "date-fns";
import openSocket from "../../services/socket-io";

import Popover from "@mui/material/Popover";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import makeStyles from '@mui/styles/makeStyles';
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";

import { ItemTrilho } from "../../layout/MainListItems";

import TicketListItem from "../TicketListItem";
import { i18n } from "../../translate/i18n";
import useTickets from "../../hooks/useTickets";
import { prepararSom, tocarClique, tocarParaMim } from "../../helpers/somDeNotificacao";
import { AuthContext } from "../../context/Auth/AuthContext";
import { AttendanceSettingsContext } from "../../context/Settings/AttendanceSettingsContext";

const useStyles = makeStyles(theme => ({
	tabContainer: {
		overflowY: "auto",
		maxHeight: 350,
		...theme.scrollbarStyles,
	},
	popoverPaper: {
		width: "100%",
		maxWidth: 350,
		marginLeft: theme.spacing(2),
		marginRight: theme.spacing(1),
		[theme.breakpoints.down('md')]: {
			maxWidth: 270,
		},
	},
	noShadow: {
		boxShadow: "none !important",
	},
	iconButton: {
		color: theme.palette.text.primary,
	},

	cabecalho: {
		display: "flex",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: theme.spacing(1),
		padding: theme.spacing(1, 1.5),
	},

	vazio: {
		padding: theme.spacing(4, 2),
		textAlign: "center",
	},
}));

const NotificationsPopOver = () => {
	const classes = useStyles();
	const { isEnabled } = useContext(AttendanceSettingsContext);

	const history = useHistory();
	const { user } = useContext(AuthContext);
	const ticketIdUrl = +history.location.pathname.split("/")[2];
	const ticketIdRef = useRef(ticketIdUrl);
	const anchorEl = useRef();
	const [isOpen, setIsOpen] = useState(false);
	const [notifications, setNotifications] = useState([]);

	const [, setDesktopNotifications] = useState([]);

	const { tickets } = useTickets({ withUnreadMessages: "true" });

	const historyRef = useRef(history);

	// O handler do socket é criado uma vez por usuário; a configuração de som
	// pode mudar depois, então ele lê sempre o valor mais recente por aqui.
	const somLigadoRef = useRef(true);
	somLigadoRef.current = isEnabled("notificationSound");

	useEffect(() => {
		prepararSom();

		if ("Notification" in window && Notification.permission === "default") {
			Notification.requestPermission();
		}
	}, []);

	useEffect(() => {
		setNotifications(tickets);
	}, [tickets]);

	useEffect(() => {
		ticketIdRef.current = ticketIdUrl;
	}, [ticketIdUrl]);

	useEffect(() => {
		const socket = openSocket();

		socket.on("connect", () => socket.emit("joinNotification"));

		socket.on("ticket", data => {
			// Conversa transferida para mim por outra pessoa: aviso com o som
			// "é seu" — antes ela só aparecia na lista, sem ninguém notar.
			const transferencia = data.action === "update" && data.transferencia;
			if (
				transferencia &&
				user?.id &&
				transferencia.paraUsuarioId === user.id &&
				transferencia.porUsuarioId !== user.id &&
				transferencia.deUsuarioId !== user.id
			) {
				avisarTransferencia(data.ticket);
			}

			if (data.action === "updateUnread" || data.action === "delete") {
				setNotifications(prevState => {
					const ticketIndex = prevState.findIndex(t => t.id === data.ticketId);
					if (ticketIndex !== -1) {
						prevState.splice(ticketIndex, 1);
						return [...prevState];
					}
					return prevState;
				});

				setDesktopNotifications(prevState => {
					const notfiticationIndex = prevState.findIndex(
						n => n.tag === String(data.ticketId)
					);
					if (notfiticationIndex !== -1) {
						prevState[notfiticationIndex].close();
						prevState.splice(notfiticationIndex, 1);
						return [...prevState];
					}
					return prevState;
				});
			}
		});

		socket.on("appMessage", data => {
			if (
				data.action === "create" &&
				!data.message.read &&
				(data.ticket.userId === user?.id || !data.ticket.userId)
			) {
				setNotifications(prevState => {
					const ticketIndex = prevState.findIndex(t => t.id === data.ticket.id);
					if (ticketIndex !== -1) {
						prevState[ticketIndex] = data.ticket;
						return [...prevState];
					}
					return [data.ticket, ...prevState];
				});

				const shouldNotNotificate =
					(data.message.ticketId === ticketIdRef.current &&
						document.visibilityState === "visible") ||
					(data.ticket.userId && data.ticket.userId !== user?.id) ||
					data.ticket.isGroup;

				if (shouldNotNotificate) return;

				handleNotifications(data);
			}
		});

		return () => {
			socket.disconnect();
		};
	}, [user]);

	/**
	 * Notificação do sistema operacional.
	 *
	 * Fica separada do som: sem permissão de notificação (ou num navegador
	 * sem suporte) o `new Notification` lançava erro e o som nunca tocava.
	 */
	const mostrarNotificacao = (titulo, corpo, ticket, icone) => {
		if (!("Notification" in window) || Notification.permission !== "granted") return;
		try {
			const notification = new Notification(titulo, {
				body: corpo,
				icon: icone,
				tag: String(ticket.id),
				renotify: true,
			});

			notification.onclick = e => {
				e.preventDefault();
				window.focus();
				historyRef.current.push(`/tickets/${ticket.id}`);
			};

			setDesktopNotifications(prevState => {
				const notfiticationIndex = prevState.findIndex(
					n => n.tag === notification.tag
				);
				if (notfiticationIndex !== -1) {
					prevState[notfiticationIndex] = notification;
					return [...prevState];
				}
				return [notification, ...prevState];
			});
		} catch (err) {
			// Alguns navegadores só aceitam notificação via service worker.
		}
	};

	const handleNotifications = data => {
		const { message, contact, ticket } = data;

		mostrarNotificacao(
			`${i18n.t("tickets.notification.message")} ${contact.name}`,
			`${message.body} - ${format(new Date(), "HH:mm")}`,
			ticket,
			contact.profilePicUrl
		);

		// Som configurável por empresa (Configurações › Geral). Conversa que é
		// minha tem som próprio, mais chamativo; o resto, o clique.
		if (somLigadoRef.current) {
			if (ticket.userId && ticket.userId === user?.id) tocarParaMim();
			else tocarClique();
		}
	};

	const avisarTransferencia = ticket => {
		if (!ticket) return;
		const nome = ticket.contact?.name || "um contato";
		mostrarNotificacao(
			"Conversa transferida para você",
			`${nome} - ${format(new Date(), "HH:mm")}`,
			ticket,
			ticket.contact?.profilePicUrl
		);
		if (somLigadoRef.current) tocarParaMim();
	};

	const handleClick = () => {
		setIsOpen(prevState => !prevState);
	};

	const handleClickAway = () => {
		setIsOpen(false);
	};

	const NotificationTicket = ({ children }) => {
		return <div onClick={handleClickAway}>{children}</div>;
	};

	return (
        <>
            <div ref={anchorEl}>
				<ItemTrilho
					rotulo="Avisos"
					Icone={NotificationsNoneIcon}
					contador={notifications.length}
					onClick={handleClick}
					dica={notifications.length ? `${notifications.length} conversas com mensagens novas` : "Nenhuma mensagem nova"}
				/>
			</div>
            <Popover
				disableScrollLock
				open={isOpen}
				anchorEl={anchorEl.current}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				transformOrigin={{
					vertical: "bottom",
					horizontal: "left",
				}}
				classes={{ paper: classes.popoverPaper }}
				onClose={handleClickAway}
			>
				<div className={classes.cabecalho}>
					<Typography variant="subtitle2">
						{i18n.t("notifications.title")}
					</Typography>
					{notifications.length > 0 && (
						<Typography variant="caption" color="textSecondary">
							{i18n.t("notifications.count", {
								count: notifications.length,
							})}
						</Typography>
					)}
				</div>
				<Divider />
				<List dense disablePadding className={classes.tabContainer}>
					{notifications.length === 0 ? (
						<div className={classes.vazio}>
							<Typography variant="body2" color="textSecondary">
								{i18n.t("notifications.noTickets")}
							</Typography>
						</div>
					) : (
						notifications.map(ticket => (
							<NotificationTicket key={ticket.id}>
								<TicketListItem ticket={ticket} />
							</NotificationTicket>
						))
					)}
				</List>
			</Popover>
        </>
    );
};

export default NotificationsPopOver;
