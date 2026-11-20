import React, { useState, useEffect } from "react";

import {
	Paper,
	Typography,
	TextField,
	Button,
	Switch,
	FormControlLabel,
	Divider,
	IconButton,
	InputAdornment,
	Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import makeStyles from '@mui/styles/makeStyles';
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n.js";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../../components/ConfirmationModal";
import { tocarClique, tocarParaMim } from "../../helpers/somDeNotificacao";

const useStyles = makeStyles(theme => ({
	section: {
		padding: theme.spacing(2),
		marginBottom: theme.spacing(2),
	},
	sectionTitle: {
		marginBottom: theme.spacing(1),
	},
	settingRow: {
		display: "flex",
		flexDirection: "column",
		paddingTop: theme.spacing(1),
		paddingBottom: theme.spacing(1),
	},
	numberField: {
		maxWidth: 240,
	},
	helper: {
		display: "block",
		marginTop: 2,
	},

	linhaToken: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: theme.spacing(2),
	},

	botaoToken: {
		whiteSpace: "nowrap",
		flexShrink: 0,
	},
}));

const PADROES_LIGADOS = { signMessages: "enabled", notificationSound: "enabled" };

// Chaves numéricas com seus defaults. Servem tanto para inicializar o estado
// local quanto para saber o que gravar quando o campo vem vazio.
const NUMBER_SETTINGS = {
	autoCloseInactiveHours: "0",
	reopenTicketWindowHours: "2",
	validadePropostaDias: "15",
};

const BOOLEAN_SETTINGS = [
	"autoAssignTickets",
	"requireClosingStatus",
	"signMessages",
	"allowAgentSeeAllTickets",
	"notificationSound",
];

const GeneralTab = ({ settings, getSettingValue, onSettingSaved }) => {
	const classes = useStyles();
	const [numbers, setNumbers] = useState(NUMBER_SETTINGS);
	const [confirmarToken, setConfirmarToken] = useState(false);

	const token =
		settings && settings.length > 0 ? getSettingValue("userApiToken") || "" : "";

	// Sincroniza os campos numéricos quando as settings chegam do backend.
	useEffect(() => {
		const next = { ...NUMBER_SETTINGS };
		Object.keys(NUMBER_SETTINGS).forEach(key => {
			const value = getSettingValue(key);
			if (value !== "" && value !== undefined && value !== null) {
				next[key] = String(value);
			}
		});
		setNumbers(next);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settings]);

	// Sem linha gravada vale o padrão do servidor (helpers/configuracoes): som e
	// assinatura nascem ligados, e a tela os mostrava desligados.
	const isEnabled = key => (getSettingValue(key) || PADROES_LIGADOS[key] || "disabled") === "enabled";

	const saveSetting = async (key, value) => {
		try {
			await api.put(`/settings/${key}`, { value });
			toast.success(i18n.t("settings.success"));
			onSettingSaved();
		} catch (err) {
			toastError(err);
		}
	};

	const handleToggle = key => (_, checked) =>
		saveSetting(key, checked ? "enabled" : "disabled");

	const handleNumberBlur = key => () => {
		const raw = numbers[key];
		const parsed = Number(raw);
		const safe = Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : NUMBER_SETTINGS[key];
		if (safe !== String(getSettingValue(key))) {
			saveSetting(key, safe);
		}
	};

	const handleGenerateToken = async () => {
		setConfirmarToken(false);
		try {
			// Quem sorteia é o servidor: Math.random não serve para segredo.
			await api.post("/settings/userApiToken/gerar");
			toast.success(i18n.t("settings.settings.apiToken.generated"));
			onSettingSaved();
		} catch (err) {
			toastError(err);
		}
	};

	const handleCopyToken = async () => {
		try {
			await navigator.clipboard.writeText(token);
			toast.success(i18n.t("settings.settings.apiToken.copied"));
		} catch {
			// Sem permissão de área de transferência (acesso por HTTP, por
			// exemplo): o token está visível e dá para copiar à mão.
		}
	};

	const renderSwitch = key => (
		<div className={classes.settingRow} key={key}>
			<FormControlLabel
				control={
					<Switch
						color="primary"
						checked={isEnabled(key)}
						onChange={handleToggle(key)}
					/>
				}
				label={i18n.t(`settings.general.${key}.label`)}
			/>
			<Typography variant="caption" color="textSecondary" className={classes.helper}>
				{i18n.t(`settings.general.${key}.helper`)}
			</Typography>
			{/* Escolher ligar ou não um som sem poder ouvi-lo é decidir no
			    escuro. O clique varia de tom a cada toque: vale apertar duas
			    vezes seguidas. */}
			{key === "notificationSound" && (
				<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
					<Button
						size="small"
						variant="outlined"
						startIcon={<VolumeUpOutlinedIcon />}
						onClick={tocarClique}
					>
						Ouvir: mensagem nova
					</Button>
					<Button
						size="small"
						variant="outlined"
						startIcon={<VolumeUpOutlinedIcon />}
						onClick={tocarParaMim}
					>
						Ouvir: conversa sua
					</Button>
				</div>
			)}
		</div>
	);

	const renderNumber = key => (
		<div className={classes.settingRow} key={key}>
			<TextField
				className={classes.numberField}
				label={i18n.t(`settings.general.${key}.label`)}
				type="number"
				inputProps={{ min: 0 }}
				variant="outlined"
				margin="dense"
				value={numbers[key]}
				onChange={e =>
					setNumbers(prev => ({ ...prev, [key]: e.target.value }))
				}
				onBlur={handleNumberBlur(key)}
			/>
			<Typography variant="caption" color="textSecondary" className={classes.helper}>
				{i18n.t(`settings.general.${key}.helper`)}
			</Typography>
		</div>
	);

	return (
		<>
			<Paper className={classes.section} variant="outlined">
				<Typography variant="subtitle1" className={classes.sectionTitle}>
					{i18n.t("settings.general.sections.attendance")}
				</Typography>
				<Divider />
				{renderSwitch("autoAssignTickets")}
				{renderSwitch("requireClosingStatus")}
				{renderSwitch("allowAgentSeeAllTickets")}
				{renderNumber("autoCloseInactiveHours")}
				{renderNumber("reopenTicketWindowHours")}
			</Paper>

			<Paper className={classes.section} variant="outlined">
				<Typography variant="subtitle1" className={classes.sectionTitle}>
					{i18n.t("settings.general.sections.experience")}
				</Typography>
				<Divider />
				{renderSwitch("signMessages")}
				{renderSwitch("notificationSound")}
			</Paper>

			<Paper className={classes.section} variant="outlined">
				<Typography variant="subtitle1" className={classes.sectionTitle}>
					Vendas
				</Typography>
				<Divider />
				{renderNumber("validadePropostaDias")}
			</Paper>

			<Paper className={classes.section} variant="outlined">
				<Typography variant="subtitle1" className={classes.sectionTitle}>
					{i18n.t("settings.general.sections.integrations")}
				</Typography>
				<Divider />

				<Typography
					variant="caption"
					color="textSecondary"
					className={classes.helper}
				>
					{i18n.t("settings.settings.apiToken.helper")}
				</Typography>

				<div className={classes.linhaToken}>
					<TextField
						id="api-token-setting"
						label={i18n.t("settings.settings.apiToken.name")}
						margin="dense"
						variant="outlined"
						fullWidth
						InputProps={{
							readOnly: true,
							endAdornment: token ? (
								<InputAdornment position="end">
									<Tooltip title={i18n.t("settings.settings.apiToken.copy")} arrow>
										<IconButton
											size="small"
											aria-label={i18n.t("settings.settings.apiToken.copy")}
											onClick={handleCopyToken}
										>
											<ContentCopyIcon fontSize="small" />
										</IconButton>
									</Tooltip>
								</InputAdornment>
							) : null,
						}}
						value={token}
						placeholder={i18n.t("settings.settings.apiToken.empty")}
					/>
					<Button
						variant="outlined"
						color="primary"
						onClick={() => setConfirmarToken(true)}
						className={classes.botaoToken}
					>
						{i18n.t("settings.settings.apiToken.generate")}
					</Button>
				</div>
			</Paper>

			<ConfirmationModal
				title={i18n.t("settings.settings.apiToken.confirmTitle")}
				open={confirmarToken}
				onClose={setConfirmarToken}
				danger
				confirmLabel={i18n.t("settings.settings.apiToken.confirmButton")}
				onConfirm={handleGenerateToken}
			>
				{i18n.t("settings.settings.apiToken.confirmMessage")}
			</ConfirmationModal>
		</>
	);
};

export { BOOLEAN_SETTINGS, NUMBER_SETTINGS };
export default GeneralTab;
