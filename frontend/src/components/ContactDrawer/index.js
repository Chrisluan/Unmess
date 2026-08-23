import React, { useState } from "react";

import makeStyles from '@mui/styles/makeStyles';
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Drawer from "@mui/material/Drawer";
import Link from "@mui/material/Link";
import InputLabel from "@mui/material/InputLabel";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";

import { i18n } from "../../translate/i18n";

import ContactModal from "../ContactModal";
import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";
import CustomerPanel from "./CustomerPanel";
import TicketDeals from "../TicketDeals";

const drawerWidth = 320;

const useStyles = makeStyles(theme => ({
	drawer: {
		width: drawerWidth,
		flexShrink: 0,
	},
	drawerPaper: {
		width: drawerWidth,
		display: "flex",
		borderTop: `1px solid ${theme.palette.divider}`,
		borderRight: `1px solid ${theme.palette.divider}`,
		borderBottom: `1px solid ${theme.palette.divider}`,
		borderTopRightRadius: 0,
		borderBottomRightRadius: 0,
	},

	// Mesma altura do cabeçalho da conversa, que fica logo ao lado: alturas
	// diferentes desenhavam um degrau bem na emenda dos dois painéis.
	header: {
		display: "flex",
		borderBottom: `1px solid ${theme.palette.divider}`,
		backgroundColor: theme.palette.background.paper,
		alignItems: "center",
		gap: theme.spacing(1),
		padding: theme.spacing(0, 0.5, 0, 2),
		minHeight: 56,
	},

	tituloHeader: {
		flex: 1,
		fontWeight: 700,
	},

	content: {
		display: "flex",
		backgroundColor: theme.palette.background.default,
		flexDirection: "column",
		gap: 8,
		padding: 8,
		height: "100%",
		overflowY: "auto",
		...theme.scrollbarStyles,
	},

	/**
	 * Foto do contato.
	 *
	 * Eram 160x160 centralizados -- metade da altura útil do painel gasta com
	 * uma imagem que, na maioria dos contatos, é só a inicial em cinza. O
	 * nome, o telefone e o cadastro do cliente, que é o que se vem consultar
	 * aqui, começavam abaixo da dobra.
	 */
	contactAvatar: {
		width: 56,
		height: 56,
		flexShrink: 0,
	},

	contactHeader: {
		display: "flex",
		gap: theme.spacing(1.5),
		alignItems: "center",
		padding: theme.spacing(1.5),
	},

	dadosContato: {
		minWidth: 0,
		flex: 1,
		display: "flex",
		flexDirection: "column",
	},

	nomeContato: {
		fontWeight: 600,
	},

	contactDetails: {
		marginTop: 8,
		padding: 8,
		display: "flex",
		flexDirection: "column",
	},
	contactExtraInfo: {
		marginTop: 4,
		padding: 6,
	},
}));

const ContactDrawer = ({
	open,
	handleDrawerClose,
	contact,
	loading,
	onDealsCarregados,
}) => {
	const classes = useStyles();

	const [modalOpen, setModalOpen] = useState(false);

	return (
        <Drawer
			className={classes.drawer}
			variant="persistent"
			anchor="right"
			open={open}
			PaperProps={{ style: { position: "absolute" } }}
			BackdropProps={{ style: { position: "absolute" } }}
			ModalProps={{
				container: document.getElementById("drawer-container"),
				style: { position: "absolute" },
			}}
			classes={{
				paper: classes.drawerPaper,
			}}
		>
            <div className={classes.header}>
				<Typography variant="subtitle1" className={classes.tituloHeader}>
					{i18n.t("contactDrawer.header")}
				</Typography>
				<Tooltip title={i18n.t("contactDrawer.close")} arrow>
					<IconButton
						onClick={handleDrawerClose}
						aria-label={i18n.t("contactDrawer.close")}
						size="small"
					>
						<CloseIcon />
					</IconButton>
				</Tooltip>
			</div>
            {loading ? (
				<ContactDrawerSkeleton classes={classes} />
			) : (
				<div className={classes.content}>
					<Paper square variant="outlined" className={classes.contactHeader}>
						<Avatar
							alt={contact.name}
							src={contact.profilePicUrl}
							className={classes.contactAvatar}
						></Avatar>

						<div className={classes.dadosContato}>
							<Typography noWrap className={classes.nomeContato}>
								{contact.name}
							</Typography>
							<Typography variant="body2" noWrap>
								<Link href={`tel:${contact.number}`}>{contact.number}</Link>
							</Typography>
						</div>

						<Button
							size="small"
							variant="outlined"
							color="primary"
							onClick={() => setModalOpen(true)}
						>
							{i18n.t("contactDrawer.buttons.edit")}
						</Button>
					</Paper>
					<ContactModal
						open={modalOpen}
						onClose={() => setModalOpen(false)}
						contactId={contact.id}
					></ContactModal>

					{/* Cadastro do cliente e pedidos primeiro: é o que se vem
					    consultar no meio de um atendimento. */}
					{contact?.id && <CustomerPanel contact={contact} />}

					{/* Pedidos da conversa: a pergunta "o que ja foi orcado?" nasce aqui,
					    no atendimento, e nao no CRM. */}
					<TicketDeals onCarregado={onDealsCarregados} />

					{contact?.extraInfo?.length > 0 && (
						<Paper square variant="outlined" className={classes.contactDetails}>
							<Typography variant="subtitle1">
								{i18n.t("contactDrawer.extraInfo")}
							</Typography>
							{contact?.extraInfo?.map(info => (
								<Paper
									key={info.id}
									square
									variant="outlined"
									className={classes.contactExtraInfo}
								>
									<InputLabel>{info.name}</InputLabel>
									<Typography component="div" noWrap style={{ paddingTop: 2 }}>
										<MarkdownWrapper>{info.value}</MarkdownWrapper>
									</Typography>
								</Paper>
							))}
						</Paper>
					)}
				</div>
			)}
        </Drawer>
    );
};

export default ContactDrawer;
