import React from "react";

import { Avatar, CardHeader, Chip, Tooltip } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	subheader: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		flexWrap: "wrap",
	},
	connectionChip: {
		height: 20,
		fontSize: "0.72rem",
		backgroundColor: "#25D366",
		color: "#fff",
		"& .MuiChip-icon": {
			color: "#fff",
			marginLeft: 4,
		},
	},
}));

const TicketInfo = ({ contact, ticket, onClick }) => {
	const classes = useStyles();

	// Mostrar por qual número a conversa está acontecendo é o que evita o
	// atendente responder pelo número errado quando há várias conexões.
	const connectionName = ticket?.whatsapp?.name;

	const subheader = (
		<span className={classes.subheader}>
			{connectionName && (
				<Tooltip title={i18n.t("ticketsList.connectionTitle")}>
					<Chip
						size="small"
						icon={<WhatsAppIcon style={{ fontSize: 14 }} />}
						label={connectionName}
						className={classes.connectionChip}
					/>
				</Tooltip>
			)}
			{ticket.user &&
				`${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`}
		</span>
	);

	return (
		<CardHeader
			onClick={onClick}
			style={{ cursor: "pointer" }}
			titleTypographyProps={{ noWrap: true }}
			subheaderTypographyProps={{ noWrap: true, component: "div" }}
			avatar={<Avatar src={contact.profilePicUrl} alt="contact_image" />}
			title={`${contact.name} #${ticket.id}`}
			subheader={subheader}
		/>
	);
};

export default TicketInfo;
