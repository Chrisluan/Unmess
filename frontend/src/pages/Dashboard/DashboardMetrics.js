import React, { useEffect, useState } from "react";

import {
    Grid,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Chip,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	PieChart,
	Pie,
	Cell,
	Legend,
	LineChart,
	Line,
} from "recharts";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import PeriodFilter, { PRESETS } from "./PeriodFilter";

const useStyles = makeStyles(theme => ({
	paper: {
		padding: theme.spacing(2),
		display: "flex",
		flexDirection: "column",
		height: "100%",
	},
	metricCard: {
		padding: theme.spacing(2),
		textAlign: "center",
	},
	chartWrapper: {
		width: "100%",
		height: 280,
	},
}));

const COLORS = ["#2E93fA", "#66DA26", "#546E7A", "#E91E63", "#FF9800", "#9C27B0"];

const formatSeconds = seconds => {
	if (seconds === null || seconds === undefined) return "—";
	const totalMinutes = Math.round(seconds / 60);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours > 0) return `${hours}h ${minutes}min`;
	return `${minutes}min`;
};

const DashboardMetrics = () => {
	const classes = useStyles();
	const [metrics, setMetrics] = useState(null);
	const [loading, setLoading] = useState(true);
	// Semana como padrão: o histórico inteiro dilui a leitura do momento atual.
	const [periodo, setPeriodo] = useState(() => ({
		preset: "week",
		...PRESETS.week(),
	}));

	useEffect(() => {
		(async () => {
			setLoading(true);
			try {
				const params = {};
				if (periodo.start && periodo.end) {
					params.startDate = periodo.start.toISOString();
					params.endDate = periodo.end.toISOString();
				}
				const { data } = await api.get("/dashboard/metrics", { params });
				setMetrics(data);
			} catch (err) {
				toastError(err);
			}
			setLoading(false);
		})();
	}, [periodo]);

	// O filtro continua visível durante o carregamento: escondê-lo faria a
	// página saltar a cada troca de período.
	const filtro = (
		<Grid item xs={12}>
			<PeriodFilter value={periodo} onChange={setPeriodo} />
		</Grid>
	);

	if (loading || !metrics) {
		return (
			<Grid container spacing={3} style={{ marginTop: 8 }}>
				{filtro}
			</Grid>
		);
	}

	return (
		<Grid container spacing={3} style={{ marginTop: 8 }}>
			{filtro}
			<Grid item xs={12} sm={6} md={3}>
				<Paper className={classes.metricCard} variant="outlined">
					<Typography variant="body2" color="textSecondary">
						{i18n.t("dashboard.metrics.avgFirstResponse")}
					</Typography>
					<Typography variant="h5">
						{formatSeconds(metrics.avgFirstResponseSeconds)}
					</Typography>
				</Paper>
			</Grid>
			<Grid item xs={12} sm={6} md={3}>
				<Paper className={classes.metricCard} variant="outlined">
					<Typography variant="body2" color="textSecondary">
						{i18n.t("dashboard.metrics.avgHandling")}
					</Typography>
					<Typography variant="h5">
						{formatSeconds(metrics.avgHandlingSeconds)}
					</Typography>
				</Paper>
			</Grid>
			<Grid item xs={12} sm={6} md={3}>
				<Paper className={classes.metricCard} variant="outlined">
					<Typography variant="body2" color="textSecondary">
						{i18n.t("dashboard.metrics.totalPeriod")}
					</Typography>
					<Typography variant="h5">{metrics.totals.totalPeriod}</Typography>
				</Paper>
			</Grid>
			<Grid item xs={12} sm={6} md={3}>
				<Paper className={classes.metricCard} variant="outlined">
					<Typography variant="body2" color="textSecondary">
						{i18n.t("dashboard.metrics.closed")}
					</Typography>
					<Typography variant="h5">{metrics.totals.closed}</Typography>
				</Paper>
			</Grid>

			{/* Segunda faixa: indicadores que apontam ação, não só volume. */}
			<Grid item xs={12} sm={6} md={3}>
				<Paper className={classes.metricCard} variant="outlined">
					<Typography variant="body2" color="textSecondary">
						{i18n.t("dashboard.metrics.resolutionRate")}
					</Typography>
					<Typography variant="h5">
						{metrics.resolutionRate == null
							? "—"
							: `${metrics.resolutionRate.toFixed(1)}%`}
					</Typography>
				</Paper>
			</Grid>
			<Grid item xs={12} sm={6} md={3}>
				<Paper className={classes.metricCard} variant="outlined">
					<Typography variant="body2" color="textSecondary">
						{i18n.t("dashboard.metrics.avgResolution")}
					</Typography>
					<Typography variant="h5">
						{formatSeconds(metrics.avgResolutionSeconds)}
					</Typography>
				</Paper>
			</Grid>
			<Grid item xs={12} sm={6} md={3}>
				<Paper className={classes.metricCard} variant="outlined">
					<Typography variant="body2" color="textSecondary">
						{i18n.t("dashboard.metrics.stalePending")}
					</Typography>
					{/* Vermelho quando há alguém esperando: é o único número
					    daqui que pede ação imediata. */}
					<Typography
						variant="h5"
						style={{ color: metrics.stalePending > 0 ? "#d64545" : undefined }}
					>
						{metrics.stalePending}
					</Typography>
				</Paper>
			</Grid>
			<Grid item xs={12} sm={6} md={3}>
				<Paper className={classes.metricCard} variant="outlined">
					<Typography variant="body2" color="textSecondary">
						{i18n.t("dashboard.metrics.newContacts")}
					</Typography>
					<Typography variant="h5">{metrics.newContacts}</Typography>
				</Paper>
			</Grid>

			<Grid item xs={12} md={8}>
				<Paper className={classes.paper} variant="outlined">
					<Typography variant="subtitle1" gutterBottom>
						{i18n.t("dashboard.metrics.byHour")}
					</Typography>
					<ResponsiveContainer width="100%" height={220}>
						<BarChart data={metrics.byHour}>
							<CartesianGrid strokeDasharray="3 3" vertical={false} />
							<XAxis dataKey="label" interval={1} tick={{ fontSize: 11 }} />
							<YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
							<Tooltip />
							<Bar dataKey="total" fill="#2576d2" radius={[6, 6, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</Paper>
			</Grid>

			<Grid item xs={12} md={4}>
				<Paper className={classes.paper} variant="outlined">
					<Typography variant="subtitle1" gutterBottom>
						{i18n.t("dashboard.metrics.byConnection")}
					</Typography>
					{metrics.byConnection.length === 0 ? (
						<Typography variant="body2" color="textSecondary">
							{i18n.t("dashboard.metrics.noData")}
						</Typography>
					) : (
						<Table size="small">
							<TableBody>
								{metrics.byConnection.map(c => (
									<TableRow key={c.whatsappId}>
										<TableCell>{c.name}</TableCell>
										<TableCell align="right">{c.totalChats}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</Paper>
			</Grid>

			{metrics.byDay.length > 1 && (
				<Grid item xs={12}>
					<Paper className={classes.paper} variant="outlined">
						<Typography variant="subtitle1" gutterBottom>
							{i18n.t("dashboard.metrics.byDay")}
						</Typography>
						<ResponsiveContainer width="100%" height={200}>
							<LineChart data={metrics.byDay}>
								<CartesianGrid strokeDasharray="3 3" vertical={false} />
								<XAxis dataKey="label" tick={{ fontSize: 11 }} />
								<YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
								<Tooltip />
								<Line
									type="monotone"
									dataKey="total"
									stroke="#2576d2"
									strokeWidth={2}
									dot={{ r: 3 }}
								/>
							</LineChart>
						</ResponsiveContainer>
					</Paper>
				</Grid>
			)}

			<Grid item xs={12} md={6}>
				<Paper className={classes.paper} variant="outlined">
					<Typography variant="subtitle1" gutterBottom>
						{i18n.t("dashboard.metrics.byAgent")}
					</Typography>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>{i18n.t("dashboard.metrics.table.agent")}</TableCell>
								<TableCell align="center">
									{i18n.t("dashboard.metrics.table.total")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("dashboard.metrics.table.avgFirstResponse")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("dashboard.metrics.table.avgHandling")}
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{metrics.byAgent.map(agent => (
								<TableRow key={agent.userId}>
									<TableCell>{agent.name}</TableCell>
									<TableCell align="center">{agent.totalChats}</TableCell>
									<TableCell align="center">
										{formatSeconds(agent.avgFirstResponseSeconds)}
									</TableCell>
									<TableCell align="center">
										{formatSeconds(agent.avgHandlingSeconds)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Paper>
			</Grid>

			<Grid item xs={12} md={6}>
				<Paper className={classes.paper} variant="outlined">
					<Typography variant="subtitle1" gutterBottom>
						{i18n.t("dashboard.metrics.byQueue")}
					</Typography>
					<div className={classes.chartWrapper}>
						<ResponsiveContainer>
							<BarChart data={metrics.byQueue}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="name" />
								<YAxis allowDecimals={false} />
								<Tooltip />
								<Bar dataKey="totalChats" fill="#2E93fA" />
							</BarChart>
						</ResponsiveContainer>
					</div>
				</Paper>
			</Grid>

			<Grid item xs={12}>
				<Paper className={classes.paper} variant="outlined">
					<Typography variant="subtitle1" gutterBottom>
						{i18n.t("dashboard.metrics.byClosingStatus")}
					</Typography>
					{metrics.byClosingStatus.length === 0 ? (
						<Typography variant="body2" color="textSecondary">
							{i18n.t("dashboard.metrics.noData")}
						</Typography>
					) : (
						<Grid container alignItems="center">
							<Grid item xs={12} md={6}>
								<div className={classes.chartWrapper}>
									<ResponsiveContainer>
										<PieChart>
											<Pie
												data={metrics.byClosingStatus}
												dataKey="total"
												nameKey="name"
												outerRadius={100}
												label
											>
												{metrics.byClosingStatus.map((entry, index) => (
													<Cell
														key={`cell-${index}`}
														fill={COLORS[index % COLORS.length]}
													/>
												))}
											</Pie>
											<Tooltip />
											<Legend />
										</PieChart>
									</ResponsiveContainer>
								</div>
							</Grid>
							<Grid item xs={12} md={6}>
								{metrics.byClosingStatus.map((status, index) => (
									<Chip
										key={index}
										label={`${status.name}: ${status.total}`}
										style={{
											margin: 4,
											backgroundColor: COLORS[index % COLORS.length],
											color: "#fff",
										}}
									/>
								))}
							</Grid>
						</Grid>
					)}
				</Paper>
			</Grid>
		</Grid>
	);
};

export default DashboardMetrics;
