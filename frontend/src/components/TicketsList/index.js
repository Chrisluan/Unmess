import React, { useState, useEffect, useReducer, useContext } from "react";
import openSocket from "../../services/socket-io";

import makeStyles from '@mui/styles/makeStyles';
import List from "@mui/material/List";

import TicketListItem from "../TicketListItem";
import TicketsListSkeleton from "../TicketsListSkeleton";
import EmptyState from "../EmptyState";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SearchOffIcon from "@mui/icons-material/SearchOff";

import useTickets from "../../hooks/useTickets";
import useTicketTabRules from "../../hooks/useTicketTabRules";
import { matchesTabRule } from "../../helpers/ticketTabRules";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
	ticketsListWrapper: {
		position: "relative",
		display: "flex",
		flex: 1,
		minHeight: 0,
		flexDirection: "column",
		overflow: "hidden",
		backgroundColor: theme.palette.unmess.superficie,
	},

	ticketsList: {
		flex: 1,
		overflowY: "auto",
		...theme.scrollbarStyles,
	},

	noTicketsText: {
		textAlign: "center",
		color: theme.palette.unmess.textoApagado,
		fontSize: "0.875rem",
		lineHeight: 1.45,
		margin: 0,
		maxWidth: 260,
	},

	noTicketsTitle: {
		textAlign: "center",
		fontSize: "1rem",
		fontWeight: 600,
		margin: 0,
		color: theme.palette.unmess.texto,
	},

	noTicketsDiv: {
		display: "flex",
		gap: 6,
		padding: theme.spacing(6, 3),
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
	},
}));

const reducer = (state, action) => {
	if (action.type === "LOAD_TICKETS") {
		const newTickets = action.payload;

		newTickets.forEach(ticket => {
			const ticketIndex = state.findIndex(t => t.id === ticket.id);
			if (ticketIndex !== -1) {
				state[ticketIndex] = ticket;
				if (ticket.unreadMessages > 0) {
					state.unshift(state.splice(ticketIndex, 1)[0]);
				}
			} else {
				state.push(ticket);
			}
		});

		return [...state];
	}

	if (action.type === "RESET_UNREAD") {
		const ticketId = action.payload;

		const ticketIndex = state.findIndex(t => t.id === ticketId);
		if (ticketIndex !== -1) {
			state[ticketIndex].unreadMessages = 0;
		}

		return [...state];
	}

	if (action.type === "UPDATE_TICKET") {
		const ticket = action.payload;

		const ticketIndex = state.findIndex(t => t.id === ticket.id);
		if (ticketIndex !== -1) {
			state[ticketIndex] = ticket;
		} else {
			state.unshift(ticket);
		}

		return [...state];
	}

	if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
		const ticket = action.payload;

		const ticketIndex = state.findIndex(t => t.id === ticket.id);
		if (ticketIndex !== -1) {
			state[ticketIndex] = ticket;
			state.unshift(state.splice(ticketIndex, 1)[0]);
		} else {
			state.unshift(ticket);
		}

		return [...state];
	}

	if (action.type === "UPDATE_TICKET_CONTACT") {
		const contact = action.payload;
		const ticketIndex = state.findIndex(t => t.contactId === contact.id);
		if (ticketIndex !== -1) {
			state[ticketIndex].contact = contact;
		}
		return [...state];
	}

	if (action.type === "DELETE_TICKET") {
		const ticketId = action.payload;
		const ticketIndex = state.findIndex(t => t.id === ticketId);
		if (ticketIndex !== -1) {
			state.splice(ticketIndex, 1);
		}

		return [...state];
	}

	if (action.type === "RESET") {
		return [];
	}
};

	const TicketsList = (props) => {
		const {
			status,
			tab,
			searchParam,
			showAll,
			selectedQueueIds,
			selectedWhatsappIds = [],
			selectedTagIds = [],
			selectedUserIds = [],
			groups,
			updateCount,
			updateTickets,
			style,
		} = props;
	const classes = useStyles();
	const [pageNumber, setPageNumber] = useState(1);
	const [ticketsList, dispatch] = useReducer(reducer, []);
	const { user } = useContext(AuthContext);

	// Serializado para poder entrar como dependência de efeito sem recriar
	// referência a cada render.
	const whatsappIdsKey = JSON.stringify(selectedWhatsappIds);
	const tagIdsKey = JSON.stringify(selectedTagIds);
	const userIdsKey = JSON.stringify(selectedUserIds);

	const { rules: tabRules, loaded: rulesLoaded } = useTicketTabRules();

	useEffect(() => {
		dispatch({ type: "RESET" });
		setPageNumber(1);
	}, [status, tab, searchParam, dispatch, showAll, selectedQueueIds, whatsappIdsKey, tagIdsKey, userIdsKey, groups]);

	const { tickets, hasMore, loading } = useTickets({
		pageNumber,
		searchParam,
		status,
		tab,
		showAll,
		queueIds: JSON.stringify(selectedQueueIds),
		whatsappIds: whatsappIdsKey,
		tagIds: tagIdsKey,
		userIds: userIdsKey,
		groups,
	});

	useEffect(() => {
		if (!status && !tab && !searchParam) return;
		dispatch({
			type: "LOAD_TICKETS",
			payload: tickets,
		});
	}, [tickets]);

	useEffect(() => {
		// Sem a regra das abas em mãos não dá para julgar pertencimento, e um
		// palpite errado aqui não é inofensivo: o tratamento de "update" abaixo
		// remove da lista o ticket que não passa no teste. Melhor esperar.
		if (tab && !rulesLoaded) return undefined;

		const socket = openSocket();

		// Respeita o filtro de conexão também no tempo real: sem isso um ticket
		// de outro número apareceria na lista filtrada ao chegar mensagem.
		const belongsToSelectedWhatsapp = ticket => {
			if (!selectedWhatsappIds || selectedWhatsappIds.length === 0) return true;
			return selectedWhatsappIds.indexOf(ticket.whatsappId) > -1;
		};

		const belongsToSelectedTags = ticket => {
			if (!selectedTagIds || selectedTagIds.length === 0) return true;
			const ticketTagIds = (ticket.tags ?? []).map(t => t.id);
			return selectedTagIds.some(id => ticketTagIds.includes(id));
		};

		// Mesma razão do filtro de conexão: sem isto, um ticket de outro
		// atendente voltaria para a lista filtrada assim que chegasse mensagem.
		const belongsToSelectedUser = ticket => {
			if (!selectedUserIds || selectedUserIds.length === 0) return true;
			// Comparação frouxa: o id vem número da API e string em algumas rotas.
			return selectedUserIds.some(id => String(id) === String(ticket.userId));
		};

		const belongsToGroupFilter = ticket => {
			if (groups === "only") return !!ticket.isGroup;
			if (groups === "exclude") return !ticket.isGroup;
			return true;
		};

		const belongsToTab = ticket => {
			if (!belongsToSelectedWhatsapp(ticket)) return false;
			if (!belongsToSelectedTags(ticket)) return false;
			if (!belongsToSelectedUser(ticket)) return false;
			if (!belongsToGroupFilter(ticket)) return false;

			// A regra de cada aba vem do backend; aqui só se obedece.
			if (tab && tabRules?.[tab]) {
				return matchesTabRule(tabRules[tab], ticket, {
					userId: user?.id,
					queueIds: selectedQueueIds,
				});
			}

			// Fallback (aba "closed"/"search" ou uso antigo baseado só em status)
			return (
				(!ticket.userId || ticket.userId === user?.id || showAll) &&
				(!ticket.queueId || selectedQueueIds.indexOf(ticket.queueId) > -1)
			);
		};

		const shouldUpdateTicket = ticket => !searchParam && belongsToTab(ticket);

		const notBelongsToUserQueues = ticket =>
			ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1;

		socket.on("connect", () => {
			if (status) {
				socket.emit("joinTickets", status);
			} else {
				socket.emit("joinNotification");
			}
		});

		socket.on("ticket", data => {
			if (data.action === "updateUnread") {
				dispatch({
					type: "RESET_UNREAD",
					payload: data.ticketId,
				});
			}

			if (data.action === "update" && shouldUpdateTicket(data.ticket)) {
				dispatch({
					type: "UPDATE_TICKET",
					payload: data.ticket,
				});
			}

			if (data.action === "update" && !shouldUpdateTicket(data.ticket)) {
				dispatch({ type: "DELETE_TICKET", payload: data.ticket.id });
			}

			if (data.action === "delete") {
				dispatch({ type: "DELETE_TICKET", payload: data.ticketId });
			}
		});

		socket.on("appMessage", data => {
			if (data.action === "create" && shouldUpdateTicket(data.ticket)) {
				dispatch({
					type: "UPDATE_TICKET_UNREAD_MESSAGES",
					payload: data.ticket,
				});
			}
		});

		socket.on("contact", data => {
			if (data.action === "update") {
				dispatch({
					type: "UPDATE_TICKET_CONTACT",
					payload: data.contact,
				});
			}
		});

		return () => {
			socket.disconnect();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status, tab, searchParam, showAll, user, selectedQueueIds, whatsappIdsKey, tagIdsKey, userIdsKey, groups, tabRules, rulesLoaded]);

	useEffect(() => {
    if (typeof updateCount === "function") {
      updateCount(ticketsList.length);
    }
    if (typeof updateTickets === "function") {
      updateTickets(ticketsList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsList]);

	const loadMore = () => {
		setPageNumber(prevState => prevState + 1);
	};

	const handleScroll = e => {
		if (!hasMore || loading) return;

		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

		if (scrollHeight - (scrollTop + 100) < clientHeight) {
			e.currentTarget.scrollTop = scrollTop - 100;
			loadMore();
		}
	};

	return (
    <div className={classes.ticketsListWrapper} style={style}>
			<div
				className={classes.ticketsList}
				onScroll={handleScroll}
			>
				<List style={{ paddingTop: 0 }}>
					{ticketsList.length === 0 && !loading ? (
						/* O texto muda com o contexto: "nada encontrado" e "nada
						   nesta aba" pedem reações diferentes de quem lê. */
						<EmptyState
							icon={searchParam ? SearchOffIcon : ForumOutlinedIcon}
							title={
								searchParam
									? i18n.t("ticketsList.empty.searchTitle")
									: i18n.t("ticketsList.empty.title")
							}
							description={
								searchParam
									? i18n.t("ticketsList.empty.searchMessage")
									: i18n.t("ticketsList.empty.message")
							}
						/>
					) : (
						<>
							{ticketsList.map(ticket => (
								<TicketListItem
									ticket={ticket}
									key={ticket.id}
									// Só na busca: no dia a dia o protocolo seria ruído em
									// todas as linhas da fila.
									mostrarProtocolo={Boolean(searchParam)}
								/>
							))}
						</>
					)}
					{loading && <TicketsListSkeleton />}
				</List>
			</div>
    </div>
	);
};

export default TicketsList;
