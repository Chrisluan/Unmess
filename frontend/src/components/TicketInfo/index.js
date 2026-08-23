import React from "react";
import { toast } from "react-toastify";

import { Avatar, CardHeader, Chip, Tooltip } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";

import { i18n } from "../../translate/i18n";
import StatusChip from "../StatusChip";

const useStyles = makeStyles((theme) => ({
	subheader: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		flexWrap: "wrap",
	},

	/**
	 * Tudo que é etiqueta no cabeçalho usa a mesma forma.
	 *
	 * A conexão vinha pintada de verde WhatsApp cheio: era o elemento mais
	 * forte da tela inteira do atendimento, disputando com o nome do cliente
	 * e com o botão de encerrar -- para informar o dado que menos muda ao
	 * longo de uma conversa. Contorno neutro com o ícone verde diz a mesma
	 * coisa sem gritar.
	 */
	etiqueta: {
		height: 20,
		fontSize: "0.72rem",
		"& .MuiChip-icon": {
			marginLeft: 4,
		},
	},

	iconeWhats: {
		fontSize: 14,
		color: "#25D366",
	},

	protocolChip: {
		cursor: "copy",
	},

	// A faixa da fila repete a cor definida no cadastro dela, a mesma que
	// marca a lateral da linha na lista: dois lugares, uma convenção.
	corFila: {
		display: "inline-block",
		width: 8,
		height: 8,
		marginRight: 2,
		flexShrink: 0,
	},

	responsavel: {
		color: theme.palette.text.secondary,
	},
}));

/**
 * Identificação da conversa aberta.
 *
 * Um atendente que acaba de abrir um atendimento precisa responder quatro
 * perguntas antes de escrever qualquer coisa: com quem estou falando, em que
 * pé está, de quem é, e por qual número/setor isso chegou. As duas do meio
 * simplesmente não estavam aqui -- o status só dava para inferir pelos botões
 * do canto oposto, e a fila não aparecia em lugar nenhum da conversa.
 *
 * O `#id` que vinha colado no nome saiu: o protocolo já identifica o
 * atendimento, é ele que o cliente informa, e dois números diferentes lado a
 * lado só fazem duvidar de qual é qual.
 */
const TicketInfo = ({ contact, ticket, onClick }) => {
	const classes = useStyles();

	const connectionName = ticket?.whatsapp?.name;
	const queue = ticket?.queue;

	const handleCopyProtocol = async (e) => {
		// Não pode abrir o drawer do contato junto.
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(ticket.protocol);
			toast.success(i18n.t("ticketInfo.protocolCopied"));
		} catch {
			// Sem permissão de clipboard (http, por exemplo): o número está
			// visível na tela, o atendente copia manualmente.
		}
	};

	const subheader = (
		<span className={classes.subheader}>
			{ticket.status && <StatusChip status={ticket.status} />}

			{queue?.name && (
				<Tooltip title={i18n.t("ticketInfo.queueTooltip")} arrow>
					<Chip
						size="small"
						variant="outlined"
						className={classes.etiqueta}
						icon={
							<span
								className={classes.corFila}
								style={{ backgroundColor: queue.color || "#7C7C7C" }}
							/>
						}
						label={queue.name}
					/>
				</Tooltip>
			)}

			{connectionName && (
				<Tooltip title={i18n.t("ticketsList.connectionTitle")} arrow>
					<Chip
						size="small"
						variant="outlined"
						icon={<WhatsAppIcon className={classes.iconeWhats} />}
						label={connectionName}
						className={classes.etiqueta}
					/>
				</Tooltip>
			)}

			{ticket.protocol && (
				<Tooltip title={i18n.t("ticketInfo.protocolTooltip")} arrow>
					<Chip
						size="small"
						variant="outlined"
						icon={<ConfirmationNumberIcon style={{ fontSize: 14 }} />}
						label={ticket.protocol}
						className={`${classes.etiqueta} ${classes.protocolChip}`}
						onClick={handleCopyProtocol}
					/>
				</Tooltip>
			)}

			<span className={classes.responsavel}>
				{ticket.user
					? `${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`
					: i18n.t("ticketInfo.unassigned")}
			</span>
		</span>
	);

	return (
		<Tooltip title={i18n.t("ticketInfo.openContact")} arrow enterDelay={600}>
			<CardHeader
				onClick={onClick}
				style={{ cursor: "pointer" }}
				titleTypographyProps={{ noWrap: true, variant: "subtitle1" }}
				subheaderTypographyProps={{ noWrap: true, component: "div" }}
				avatar={<Avatar src={contact.profilePicUrl} alt="" />}
				title={contact.name}
				subheader={subheader}
			/>
		</Tooltip>
	);
};

export default TicketInfo;
