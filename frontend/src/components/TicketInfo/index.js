import React, { useEffect, useState } from "react";

import { Avatar, ButtonBase, Tooltip } from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';

import api from "../../services/api";
import { totalDaLinha } from "../Crm/calculoItem";

const useStyles = makeStyles(theme => {
	const c = theme.palette.unmess;
	return {
		root: {
			flex: 1,
			minWidth: 0,
			display: "flex",
			alignItems: "center",
			gap: 12,
			justifyContent: "flex-start",
			textAlign: "left",
			borderRadius: 12,
			padding: "4px 8px 4px 4px",
			"&:hover": { backgroundColor: c.hover },
		},
		avatar: { width: 44, height: 44, flex: "none" },
		textos: { minWidth: 0, display: "flex", flexDirection: "column" },
		nome: {
			fontWeight: 600,
			fontSize: "1rem",
			color: c.texto,
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis",
		},
		sub: {
			fontSize: "0.8125rem",
			color: c.textoApagado,
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis",
		},
	};
});

const useStylesNegocio = makeStyles(theme => {
	const c = theme.palette.unmess;
	return {
		chip: {
			height: 32,
			padding: "0 12px",
			borderRadius: 999,
			backgroundColor: c.primariaSuave,
			color: c.primariaSuaveTexto,
			fontWeight: 600,
			fontSize: "0.8125rem",
			whiteSpace: "nowrap",
			flex: "none",
			[theme.breakpoints.down("lg")]: { display: "none" },
		},
	};
});

const moeda = valor =>
	valor === null || valor === undefined
		? "—"
		: Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const totalDoPedido = deal =>
	// Itens sem preço (oculto pelo servidor) não somam zero: não há total a mostrar.
	// Mesma conta do servidor (m², metro linear, mínimo por peça): a de
	// quantidade × preço mostrava aqui um valor e no orçamento outro.
	(deal.items || []).some(i => i.unitPrice === null) ? null : (deal.items || []).reduce(
		(s, i) => s + totalDaLinha(i),
		0
	);

export const ChipNegocio = ({ ticketId, onClick }) => {
	const classes = useStylesNegocio();
	const [negocio, setNegocio] = useState(null);

	useEffect(() => {
		let ativo = true;
		setNegocio(null);
		if (!ticketId) return undefined;
		api
			.get(`/tickets/${ticketId}/deals`)
			.then(({ data }) => {
				if (!ativo) return;
				const deal = (data.deals || []).find(d => !d.archivedAt);
				setNegocio(deal || null);
			})
			.catch(() => ativo && setNegocio(null));
		return () => {
			ativo = false;
		};
	}, [ticketId]);

	if (!negocio) return null;

	return (
		<Tooltip title="Pedido ligado a esta conversa">
			<ButtonBase className={classes.chip} onClick={onClick}>
				{negocio.stage?.name || "Pedido"} · {moeda(totalDoPedido(negocio))}
			</ButtonBase>
		</Tooltip>
	);
};

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

	const partes = [
		ticket.queue?.name,
		ticket.user ? `com ${ticket.user.name}` : null,
		ticket.whatsapp?.name ? `pelo ${ticket.whatsapp.name}` : null,
	].filter(Boolean);

	return (
		<Tooltip title="Ver detalhes do cliente">
			<ButtonBase className={classes.root} onClick={onClick}>
				<Avatar src={contact.profilePicUrl} alt={contact.name} className={classes.avatar}>
					{contact.name?.[0]?.toUpperCase()}
				</Avatar>
				<span className={classes.textos}>
					<span className={classes.nome}>{contact.name}</span>
					<span className={classes.sub}>{partes.join(" · ") || contact.number}</span>
				</span>
			</ButtonBase>
		</Tooltip>
	);
};

export default TicketInfo;
