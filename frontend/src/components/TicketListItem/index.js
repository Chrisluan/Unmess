import React, { useState, useEffect, useRef, useContext } from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import makeStyles from '@mui/styles/makeStyles';
import ListItemButton from "@mui/material/ListItemButton";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";

import { i18n } from "../../translate/i18n";
import { formatWaitingTime, waitingLevel } from "../../helpers/waitingTime";
import { ticketDate } from "../../helpers/messageDate";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import { Tooltip } from "@mui/material";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	// Três colunas: avatar (fixo), miolo (elástico) e trilho direito (fixo).
	// Antes o botão e a tag da conexão eram position:absolute e passavam por
	// cima do nome e da prévia da mensagem.
	ticket: {
		position: "relative",
		display: "flex",
		alignItems: "flex-start",
		gap: 10,
		paddingLeft: 18, // espaço para a faixa colorida do setor
		paddingRight: 10,
		paddingTop: 8,
		paddingBottom: 8,
		// A conversa aberta é marcada como o item de menu ativo: mesma
		// gramática visual nos dois lugares, uma coisa a menos para aprender.
		"&.Mui-selected": {
			backgroundColor: theme.palette.action.selected,
		},
		"&.Mui-selected $nome": {
			color: theme.palette.primary.main,
		},
	},

	pendingTicket: {
		cursor: "pointer",
	},

	avatarBox: {
		minWidth: "auto",
		marginTop: 2,
	},

	miolo: {
		flex: 1,
		minWidth: 0, // sem isto o texto empurra o trilho para fora da lista
		display: "flex",
		flexDirection: "column",
		gap: 2,
	},

	linhaNome: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		minWidth: 0,
	},

	nome: {
		fontWeight: 600,
		minWidth: 0,
	},

	previa: {
		minWidth: 0,
		"& p": { margin: 0 },
	},

	naoLidas: {
		flexShrink: 0,
		minWidth: 18,
		height: 18,
		padding: "0 5px",
		borderRadius: 0,
		backgroundColor: theme.palette.primary.main,
		color: theme.palette.primary.contrastText,
		fontSize: "0.68rem",
		fontWeight: 700,
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
	},

	trilho: {
		flexShrink: 0,
		display: "flex",
		flexDirection: "column",
		alignItems: "flex-end",
		gap: 4,
		maxWidth: 132,
	},

	linhaTopo: {
		display: "flex",
		alignItems: "center",
		gap: 4,
	},

	noTicketsDiv: {
		display: "flex",
		height: "100px",
		margin: 40,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
	},

	noTicketsText: {
		textAlign: "center",
		color: theme.palette.text.secondary,
		fontSize: "14px",
		lineHeight: "1.4",
	},

	noTicketsTitle: {
		textAlign: "center",
		fontSize: "16px",
		fontWeight: "600",
		margin: "0px",
	},

	// Tempo de espera: numa fila, saber há quanto tempo o cliente aguarda vale
	// mais que qualquer outro dado da linha. Muda de cor conforme atrasa.
	waitBadge: {
		display: "inline-flex",
		alignItems: "center",
		gap: 3,
		marginLeft: 6,
		padding: "1px 7px",
		borderRadius: 0,
		fontSize: "0.68rem",
		fontWeight: 700,
		whiteSpace: "nowrap",
	},
	// Contorno em vez de fundo translúcido: o fundo claro somia no modo escuro,
	// e era justamente o dado mais urgente da linha.
	waitOk: {
		color: theme.palette.text.secondary,
		border: "1px solid currentColor",
	},
	waitAtencao: {
		color: theme.palette.warning.main,
		border: "1px solid currentColor",
	},
	waitCritico: {
		color: theme.palette.error.contrastText || "#fff",
		backgroundColor: theme.palette.error.main,
	},
	waitIcon: {
		fontSize: "0.82rem",
	},

	acceptButton: {
		minWidth: 0,
		padding: "2px 12px",
		fontSize: "0.75rem",
		whiteSpace: "nowrap",
	},

	ticketQueueColor: {
		flex: "none",
		width: "4px",
		height: "100%",
		position: "absolute",
		top: "0%",
		left: "0%",
	},

	tagsWrapper: {
		display: "inline-flex",
		gap: 4,
		flexWrap: "nowrap",
		overflow: "hidden",
		marginLeft: 4,
	},

	tagChip: {
		color: "#fff",
		borderRadius: 0,
		padding: "0 6px",
		fontSize: "0.68rem",
		lineHeight: "16px",
		whiteSpace: "nowrap",
		maxWidth: 80,
		overflow: "hidden",
		textOverflow: "ellipsis",
	},

	// Só aparece nos resultados de busca: quem procurou por protocolo precisa
	// confirmar que achou o atendimento certo sem abrir a conversa.
	protocolo: {
		fontFamily: "monospace",
		fontSize: "0.68rem",
		letterSpacing: "0.02em",
		color: theme.palette.text.secondary,
	},

	/**
	 * Etiqueta discreta do trilho da direita.
	 *
	 * A conexão vinha num bloco azul cheio -- a cor que no sistema significa
	 * "clicável / ativo" -- repetido em toda linha da lista. Era o elemento
	 * mais forte da tela para o dado que menos ajuda a decidir qual conversa
	 * abrir. Contorno neutro devolve a cor cheia para quem precisa dela: o
	 * contador de não lidas e o botão de aceitar.
	 */
	etiquetaTrilho: {
		maxWidth: "100%",
		color: theme.palette.text.secondary,
		border: `1px solid ${theme.palette.divider}`,
		padding: "0 6px",
		borderRadius: 0,
		fontSize: "0.68rem",
		fontWeight: 600,
		lineHeight: "16px",
		whiteSpace: "nowrap",
		overflow: "hidden",
		textOverflow: "ellipsis",
	},

	// Quem está com a conversa. Ausente da lista até agora: dava para ver a
	// conexão de cada linha, mas não de quem era o atendimento -- que é a
	// pergunta que se faz ao olhar a aba "Em atendimento".
	responsavel: {
		maxWidth: "100%",
		display: "inline-flex",
		alignItems: "center",
		gap: 3,
		color: theme.palette.text.secondary,
		fontSize: "0.68rem",
		fontWeight: 600,
		whiteSpace: "nowrap",
		overflow: "hidden",
		textOverflow: "ellipsis",
	},

	iconeResponsavel: {
		fontSize: "0.85rem",
	},
}));

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

	const espera =
		ticket.status === "pending"
			? formatWaitingTime(ticketDate(ticket), agora)
			: null;
	const nivelEspera = waitingLevel(ticketDate(ticket), agora);
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
		<React.Fragment key={ticket.id}>
			{/* ListItemButton porque o prop `button` do ListItem saiu no MUI v6:
			    mantê-lo deixava a linha sem hover, foco nem ripple. */}
			<ListItemButton
				dense
				// Pendente também abre: dá para ler o que o cliente quer antes de
				// puxar o atendimento. O envio continua bloqueado enquanto o
				// ticket não for aceito, então abrir não assume a conversa.
				onClick={() => handleSelectTicket(ticket.id)}
				selected={ticketId && +ticketId === ticket.id}
				className={clsx(classes.ticket, {
					[classes.pendingTicket]: ticket.status === "pending",
				})}
			>
				<Tooltip
					arrow
					placement="right"
					title={ticket.queue?.name || "Sem fila"}
				>
					<span
						style={{ backgroundColor: ticket.queue?.color || "#7C7C7C" }}
						className={classes.ticketQueueColor}
					></span>
				</Tooltip>
				<ListItemAvatar className={classes.avatarBox}>
					<Avatar src={ticket?.contact?.profilePicUrl} />
				</ListItemAvatar>

				{/* Coluna do meio: encolhe e trunca. O minWidth 0 é o que permite
				    o texto ser cortado em vez de empurrar a coluna da direita. */}
				<div className={classes.miolo}>
					<div className={classes.linhaNome}>
						<Typography noWrap component="span" variant="body2" className={classes.nome}>
							{ticket.contact.name}
						</Typography>
						{ticket.unreadMessages > 0 && (
							<span className={classes.naoLidas}>{ticket.unreadMessages}</span>
						)}
					</div>

					<Typography
						noWrap
						component="div"
						variant="body2"
						color="textSecondary"
						className={classes.previa}
					>
						{ticket.lastMessage ? (
							<MarkdownWrapper>{ticket.lastMessage}</MarkdownWrapper>
						) : (
							" "
						)}
					</Typography>

					{mostrarProtocolo && ticket.protocol && (
						<Typography
							noWrap
							component="span"
							variant="caption"
							className={classes.protocolo}
							title={i18n.t("ticketsList.protocol")}
						>
							{ticket.protocol}
						</Typography>
					)}

					{ticket.tags?.length > 0 && (
						<div className={classes.tagsWrapper}>
							{ticket.tags.slice(0, 2).map(tag => (
								<span
									key={tag.id}
									className={classes.tagChip}
									style={{ backgroundColor: tag.color }}
									title={tag.name}
								>
									{tag.name}
								</span>
							))}
							{ticket.tags.length > 2 && (
								<span className={classes.tagChip} style={{ backgroundColor: "#95a5a6" }}>
									+{ticket.tags.length - 2}
								</span>
							)}
						</div>
					)}
				</div>

				{/* Coluna da direita: largura própria, nunca sobreposta ao texto. */}
				<div className={classes.trilho}>
					<div className={classes.linhaTopo}>
						<Typography component="span" variant="caption" color="textSecondary">
							{isSameDay(parseISO(ticketDate(ticket)), new Date())
								? format(parseISO(ticketDate(ticket)), "HH:mm")
								: format(parseISO(ticketDate(ticket)), "dd/MM/yy")}
						</Typography>
						{ticket.status === "pending" && espera && (
							<span
								className={clsx(classes.waitBadge, {
									[classes.waitOk]: nivelEspera === "ok",
									[classes.waitAtencao]: nivelEspera === "atencao",
									[classes.waitCritico]: nivelEspera === "critico",
								})}
								title={i18n.t("ticketsList.waitingFor")}
							>
								<AccessTimeIcon className={classes.waitIcon} />
								{espera}
							</span>
						)}
					</div>

					{/* Só quando não é meu: repetir o próprio nome em toda linha da
					    aba "Minhas" não informa nada. */}
					{ticket.user?.name && ticket.user.id !== user?.id && (
						<span
							className={classes.responsavel}
							title={`${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`}
						>
							<PersonOutlineIcon className={classes.iconeResponsavel} />
							{ticket.user.name}
						</span>
					)}

					{ticket.whatsappId && ticket.whatsapp?.name && (
						<span
							className={classes.etiquetaTrilho}
							title={i18n.t("ticketsList.connectionTitle")}
						>
							{ticket.whatsapp.name}
						</span>
					)}

					{/* Conhecido não se aceita: qualquer atendente já pode responder. */}
					{ticket.status === "pending" && !ticket.contact?.isKnown && (
						<ButtonWithSpinner
							color="primary"
							variant="contained"
							className={classes.acceptButton}
							size="small"
							loading={loading}
							onClick={e => {
								// Sem isto o clique subiria para a linha e abriria a
								// conversa junto com o aceite.
								e.stopPropagation();
								handleAcepptTicket(ticket.id);
							}}
						>
							{i18n.t("ticketsList.buttons.accept")}
						</ButtonWithSpinner>
					)}
				</div>
			</ListItemButton>
			<Divider variant="inset" component="li" />
		</React.Fragment>
	);
};

export default TicketListItem;
