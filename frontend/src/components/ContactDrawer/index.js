import React, { useState } from "react";
import { toast } from "react-toastify";

import makeStyles from '@mui/styles/makeStyles';
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import { i18n } from "../../translate/i18n";

import ContactModal from "../ContactModal";
import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";
import CustomerPanel from "./CustomerPanel";
import TicketDeals from "../TicketDeals";
import TicketTagsSelect from "../TicketTagsSelect";

export const useSecaoStyles = makeStyles(theme => {
	const c = theme.palette.unmess;
	return {
		secao: {
			padding: "18px 20px",
			borderBottom: `1px solid ${c.linha}`,
			display: "flex",
			flexDirection: "column",
			gap: 10,
		},
		secaoTopo: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
			minHeight: 28,
		},
		secaoTitulo: {
			fontSize: "0.875rem",
			fontWeight: 600,
			color: c.texto,
			margin: 0,
		},
		linhas: {
			display: "grid",
			gridTemplateColumns: "auto 1fr",
			gap: "8px 14px",
			fontSize: "0.875rem",
			margin: 0,
			"& dt": { color: c.textoApagado },
			"& dd": { margin: 0, textAlign: "right", fontWeight: 500, wordBreak: "break-word" },
		},
		vazio: { fontSize: "0.8125rem", color: c.textoApagado },
	};
});

const LARGURA = 340;

const useStyles = makeStyles(theme => {
	const c = theme.palette.unmess;
	return {
		painel: {
			width: LARGURA,
			flex: "none",
			height: "100%",
			display: "flex",
			flexDirection: "column",
			backgroundColor: c.superficie,
			borderLeft: `1px solid ${c.linha}`,
			overflowY: "auto",
			...theme.scrollbarStyles,
			[theme.breakpoints.down("xl")]: {
				position: "absolute",
				top: 0,
				right: 0,
				bottom: 0,
				zIndex: 5,
				boxShadow: c.sombraFlutuante,
			},
			[theme.breakpoints.down("sm")]: {
				width: "100%",
			},
		},
		fechar: {
			position: "absolute",
			top: 10,
			right: 10,
		},
		topo: {
			position: "relative",
			padding: "28px 20px 20px",
			textAlign: "center",
			borderBottom: `1px solid ${c.linha}`,
		},
		avatar: {
			width: 72,
			height: 72,
			fontSize: 26,
			margin: "0 auto 10px",
		},
		nome: { fontWeight: 600, fontSize: "1.0625rem", display: "block", wordBreak: "break-word" },
		numero: { color: c.textoApagado, fontSize: "0.875rem" },
		acoes: { display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" },
		protocolo: {
			fontFamily: "ui-monospace, monospace",
			fontSize: "0.8125rem",
		},
	};
});

const ContactDrawer = ({ open, handleDrawerClose, contact, ticket, loading }) => {
	const classes = useStyles();
	const s = useSecaoStyles();

	const [modalOpen, setModalOpen] = useState(false);

	if (!open) return null;

	const copiarProtocolo = async () => {
		try {
			await navigator.clipboard.writeText(ticket.protocol);
			toast.success(i18n.t("ticketInfo.protocolCopied"));
		} catch {
			toast.info(ticket.protocol);
		}
	};

	return (
		<aside className={classes.painel} aria-label={i18n.t("contactDrawer.header")}>
			{loading ? (
				<ContactDrawerSkeleton classes={classes} />
			) : (
				<>
					<div className={classes.topo}>
						<Tooltip title="Fechar">
							<IconButton className={classes.fechar} onClick={handleDrawerClose} aria-label="Fechar detalhes">
								<CloseIcon />
							</IconButton>
						</Tooltip>
						<Avatar alt={contact.name} src={contact.profilePicUrl} className={classes.avatar}>
							{contact.name?.[0]?.toUpperCase()}
						</Avatar>
						<span className={classes.nome}>{contact.name}</span>
						<span className={classes.numero}>{contact.number}</span>
						<div className={classes.acoes}>
							<Button size="small" variant="outlined" startIcon={<PhoneOutlinedIcon />} href={`tel:${contact.number}`}>
								Ligar
							</Button>
							<Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setModalOpen(true)}>
								Editar
							</Button>
						</div>
					</div>

					<ContactModal open={modalOpen} onClose={() => setModalOpen(false)} contactId={contact.id} />

					<TicketDeals />

					{ticket?.id && (
						<div className={s.secao}>
							<div className={s.secaoTopo}>
								<h3 className={s.secaoTitulo}>Etiquetas</h3>
							</div>
							<TicketTagsSelect ticket={ticket} disabled={ticket.status === "closed"} />
						</div>
					)}

					{contact?.id && <CustomerPanel contact={contact} />}

					{contact?.extraInfo?.length > 0 && (
						<div className={s.secao}>
							<div className={s.secaoTopo}>
								<h3 className={s.secaoTitulo}>{i18n.t("contactDrawer.extraInfo")}</h3>
							</div>
							<dl className={s.linhas}>
								{contact.extraInfo.map(info => (
									<React.Fragment key={info.id}>
										<dt>{info.name}</dt>
										<dd>
											<MarkdownWrapper>{info.value}</MarkdownWrapper>
										</dd>
									</React.Fragment>
								))}
							</dl>
						</div>
					)}

					{ticket?.protocol && (
						<div className={s.secao} style={{ borderBottom: 0 }}>
							<div className={s.secaoTopo}>
								<h3 className={s.secaoTitulo}>Protocolo</h3>
								<Tooltip title={i18n.t("ticketInfo.protocolTooltip")}>
									<Button size="small" startIcon={<ContentCopyIcon />} onClick={copiarProtocolo}>
										Copiar
									</Button>
								</Tooltip>
							</div>
							<span className={classes.protocolo}>{ticket.protocol}</span>
						</div>
					)}
				</>
			)}
		</aside>
	);
};

export default ContactDrawer;
