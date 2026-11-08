import React, { useState, useEffect, useRef, useContext } from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import makeStyles from '@mui/styles/makeStyles';
import { alpha } from "@mui/material/styles";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ReplyIcon from "@mui/icons-material/ReplyOutlined";

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

	/**
	 * Linha com mensagem que o cliente mandou e ninguém leu.
	 *
	 * O contador sozinho é um detalhe de 20px no meio de uma lista longa: quem
	 * varre a lista de relance não o encontra. O que faz a linha saltar é o
	 * conjunto — fundo tingido, nome e prévia em texto cheio, contador no
	 * trilho. É a mesma gramática do e-mail não lido, que já se lê sem
	 * precisar aprender.
	 *
	 * Especificidade de propósito baixa (uma classe só): tanto o `:hover` do
	 * ListItemButton quanto o `&.Mui-selected` acima têm duas, então a linha
	 * continua reagindo ao mouse e a conversa aberta continua se destacando
	 * como aberta.
	 */
	naoLido: {
		backgroundColor: alpha(theme.palette.success.main, 0.1),
	},

	nomeNaoLido: {
		fontWeight: 800,
		color: theme.palette.text.primary,
	},

	previaNaoLida: {
		fontWeight: 600,
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

	/**
	 * Marca de "a última fala foi nossa".
	 *
	 * A prévia mostrava só o texto, então não dava para saber, sem abrir a
	 * conversa, se o cliente estava esperando resposta ou se a bola já tinha
	 * voltado para ele. A seta ocupa pouco e responde isso de relance.
	 */
	marcaRespondido: {
		fontSize: 14,
		marginRight: 4,
		verticalAlign: "-2px",
		flexShrink: 0,
		color: theme.palette.text.disabled,
	},

	/**
	 * Contador de não lidas, no trilho da direita.
	 *
	 * Ficava colado ao nome, dentro da coluna que trunca: em nome comprido ele
	 * era o primeiro a sumir. No trilho a largura é fixa e o número nunca é
	 * cortado. Verde, e não azul nem vermelho: azul aqui significa "clicável" e
	 * vermelho já é do aviso de espera crítica, que precisa continuar sendo o
	 * único elemento em vermelho da linha.
	 */
	naoLidas: {
		flexShrink: 0,
		minWidth: 20,
		height: 20,
		padding: "0 6px",
		borderRadius: 0,
		backgroundColor: theme.palette.success.main,
		color: theme.palette.success.contrastText || "#fff",
		fontSize: "0.72rem",
		fontWeight: 800,
		lineHeight: 1,
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

	// Quantas mensagens o cliente mandou desde a última vez que alguém leu.
	const naoLidas = ticket.unreadMessages > 0 ? ticket.unreadMessages : 0;

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
					[classes.naoLido]: naoLidas > 0,
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
						<Typography
							noWrap
							component="span"
							variant="body2"
							className={clsx(classes.nome, {
								[classes.nomeNaoLido]: naoLidas > 0,
							})}
						>
							{ticket.contact.name}
						</Typography>
					</div>

					<Typography
						noWrap
						component="div"
						variant="body2"
						// Texto cheio quando há algo por ler: é o mesmo truque do
						// e-mail, e não precisa de `!important` para vencer a classe
						// de cor do Typography.
						color={naoLidas > 0 ? "textPrimary" : "textSecondary"}
						className={clsx(classes.previa, {
							[classes.previaNaoLida]: naoLidas > 0,
						})}
					>
						{ticket.lastMessage ? (
							<>
								{ticket.lastMessageFromMe && (
									<Tooltip
										title={i18n.t("ticketsList.lastMessageFromMe")}
										arrow
									>
										<ReplyIcon className={classes.marcaRespondido} />
									</Tooltip>
								)}
								<MarkdownWrapper>{ticket.lastMessage}</MarkdownWrapper>
							</>
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

					{/* Logo abaixo da hora, alinhado à direita: é onde o olho já
					    procura o contador em qualquer aplicativo de mensagem. */}
					{naoLidas > 0 && (
						<span
							className={classes.naoLidas}
							title={i18n.t("ticketsList.unread", { count: naoLidas })}
						>
							{naoLidas > 99 ? "99+" : naoLidas}
						</span>
					)}

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
