import React, { useContext } from "react"

import Paper from "@mui/material/Paper"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import makeStyles from '@mui/styles/makeStyles';
import Typography from "@mui/material/Typography";

import useTickets from "../../hooks/useTickets"

import { AuthContext } from "../../context/Auth/AuthContext";

import { i18n } from "../../translate/i18n";

import Chart from "./Chart"
import DashboardMetrics from "./DashboardMetrics"

const useStyles = makeStyles(theme => {
	const c = theme.palette.unmess
	return {
		container: {
			padding: theme.spacing(3, 4, 4),
			maxWidth: 1280,
			[theme.breakpoints.down("sm")]: {
				padding: theme.spacing(2),
			},
		},
		cabecalho: {
			marginBottom: theme.spacing(2.5),
		},
		rotulo: {
			fontSize: "0.8125rem",
			fontWeight: 600,
			color: c.textoApagado,
		},
		kpi: {
			padding: theme.spacing(2.25, 2.5),
			border: `1px solid ${c.linha}`,
			borderRadius: 16,
			height: "100%",
		},
		kpiDestaque: {
			backgroundColor: c.primariaSuave,
			borderColor: "transparent",
			"& $rotulo, & $numero": { color: c.primariaSuaveTexto },
		},
		numero: {
			fontWeight: 700,
			fontSize: "1.875rem",
			letterSpacing: "-0.02em",
			lineHeight: 1.2,
			marginTop: 6,
		},
		fixedHeightPaper: {
			padding: theme.spacing(2.5),
			display: "flex",
			overflow: "auto",
			flexDirection: "column",
			height: 280,
			border: `1px solid ${c.linha}`,
			borderRadius: 16,
		},
	}
})

const Dashboard = () => {
	const classes = useStyles()

	const { user } = useContext(AuthContext);
	var userQueueIds = [];

	if (user.queues && user.queues.length > 0) {
		userQueueIds = user.queues.map(q => q.id);
	}

	const GetTickets = (status, showAll, withUnreadMessages) => {

		const { count } = useTickets({
			status: status,
			showAll: showAll,
			withUnreadMessages: withUnreadMessages,
			queueIds: JSON.stringify(userQueueIds)
		});
		return count;
	}

	return (
		<div>
			<Container maxWidth={false} className={classes.container}>
				<div className={classes.cabecalho}>
					<span className={classes.rotulo}>Painel</span>
					<Typography component="h1" sx={{ fontWeight: 700, fontSize: "1.375rem", letterSpacing: "-0.015em" }}>
						Como está o dia
					</Typography>
				</div>
				<Grid container spacing={2}>
					<Grid item xs={12} sm={4}>
						<Paper className={`${classes.kpi} ${classes.kpiDestaque}`}>
							<span className={classes.rotulo}>{i18n.t("dashboard.messages.inAttendance.title")}</span>
							<div className={classes.numero}>{GetTickets("open", "true", "false")}</div>
						</Paper>
					</Grid>
					<Grid item xs={12} sm={4}>
						<Paper className={classes.kpi}>
							<span className={classes.rotulo}>{i18n.t("dashboard.messages.waiting.title")}</span>
							<div className={classes.numero}>{GetTickets("pending", "true", "false")}</div>
						</Paper>
					</Grid>
					<Grid item xs={12} sm={4}>
						<Paper className={classes.kpi}>
							<span className={classes.rotulo}>{i18n.t("dashboard.messages.closed.title")}</span>
							<div className={classes.numero}>{GetTickets("closed", "true", "false")}</div>
						</Paper>
					</Grid>
					<Grid item xs={12}>
						<Paper className={classes.fixedHeightPaper}>
							<Chart />
						</Paper>
					</Grid>
				</Grid>
				<DashboardMetrics />
			</Container>
		</div>
	)
}

export default Dashboard
