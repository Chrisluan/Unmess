import React, { useContext } from "react";

import Paper from "@mui/material/Paper";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import makeStyles from "@mui/styles/makeStyles";
import Typography from "@mui/material/Typography";

import useTickets from "../../hooks/useTickets";

import { AuthContext } from "../../context/Auth/AuthContext";

import { i18n } from "../../translate/i18n";

import DashboardMetrics from "./DashboardMetrics";

const useStyles = makeStyles((theme) => ({
	container: {
		paddingTop: theme.spacing(3),
		paddingBottom: theme.spacing(4),
	},

	/**
	 * Cartão de número da faixa "agora".
	 *
	 * O rótulo vinha em h6 azul: azul é a cor do que se clica, e o cartão não
	 * é clicável. Pior, o rótulo ficava mais forte que o número — que é a
	 * única coisa que a pessoa veio ler. Agora o rótulo é texto de apoio e o
	 * número carrega o peso, igual à faixa de indicadores logo abaixo, que já
	 * fazia assim.
	 */
	cartao: {
		padding: theme.spacing(2),
		border: `1px solid ${theme.palette.divider}`,
		height: "100%",
		display: "flex",
		flexDirection: "column",
		gap: 2,
	},

	numero: {
		fontWeight: 700,
		fontVariantNumeric: "tabular-nums",
		lineHeight: 1.1,
	},

	// Cliente esperando é o único número da faixa que piora sozinho com o
	// tempo, e o único que pede uma ação agora.
	alerta: {
		color: theme.palette.warning.main,
	},

	tituloSecao: {
		fontSize: "0.7rem",
		fontWeight: 700,
		letterSpacing: "0.1em",
		textTransform: "uppercase",
		color: theme.palette.text.secondary,
		marginBottom: theme.spacing(1),
	},
}));

/**
 * Visão geral.
 *
 * A tela tinha duas leituras de tempo misturadas sem aviso: três cartões com
 * o estado agora e, logo abaixo, uma faixa inteira filtrada por período. O
 * mesmo número aparecia com valores diferentes nos dois lugares e nada
 * explicava a diferença. Agora cada bloco tem um título dizendo a que tempo
 * ele se refere.
 *
 * Havia também dois gráficos de barras por hora do dia, um em cada bloco. O
 * de cima só cobria das 8h às 19h — horário fixo no código — e não respeitava
 * o filtro de período. Ficou o de baixo, que cobre as 24 horas e acompanha o
 * período escolhido.
 */
const Dashboard = () => {
	const classes = useStyles();

	const { user } = useContext(AuthContext);
	const userQueueIds = (user.queues || []).map((q) => q.id);
	const queueIds = JSON.stringify(userQueueIds);

	// Um hook por cartão, em ordem fixa. Antes os três saíam de uma função
	// chamada dentro do JSX, o que só funcionava porque a ordem das chamadas
	// nunca mudava — a primeira condicional quebraria as regras de hooks.
	const emAtendimento = useTickets({ status: "open", showAll: "true", queueIds });
	const aguardando = useTickets({ status: "pending", showAll: "true", queueIds });
	const encerradas = useTickets({ status: "closed", showAll: "true", queueIds });

	const cartoes = [
		{
			rotulo: i18n.t("dashboard.messages.inAttendance.title"),
			valor: emAtendimento.count,
			apoio: i18n.t("dashboard.now.inAttendanceHelp"),
		},
		{
			rotulo: i18n.t("dashboard.messages.waiting.title"),
			valor: aguardando.count,
			apoio: i18n.t("dashboard.now.waitingHelp"),
			alerta: aguardando.count > 0,
		},
		{
			rotulo: i18n.t("dashboard.messages.closed.title"),
			valor: encerradas.count,
			apoio: i18n.t("dashboard.now.closedHelp"),
		},
	];

	return (
		<Container maxWidth="lg" className={classes.container}>
			<Typography variant="h5" gutterBottom>
				{i18n.t("mainDrawer.listItems.dashboard")}
			</Typography>

			<Typography component="h2" className={classes.tituloSecao}>
				{i18n.t("dashboard.now.title")}
			</Typography>

			<Grid container spacing={2}>
				{cartoes.map((c) => (
					/* xs=4 fixo espremia três cartões em um terço da tela no
					   celular; o número virava uma coluna de dois dígitos. */
					<Grid item xs={12} sm={4} key={c.rotulo}>
						<Paper className={classes.cartao} variant="outlined">
							<Typography variant="body2" color="textSecondary">
								{c.rotulo}
							</Typography>
							<Typography
								variant="h4"
								className={`${classes.numero} ${c.alerta ? classes.alerta : ""}`}
							>
								{c.valor}
							</Typography>
							<Typography variant="caption" color="textSecondary">
								{c.apoio}
							</Typography>
						</Paper>
					</Grid>
				))}
			</Grid>

			<DashboardMetrics />
		</Container>
	);
};

export default Dashboard;
