import React, { useState, useEffect } from "react";

import { Paper, Typography, TextField, Button, Switch, FormControlLabel, Divider } from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n.js";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	paper: {
		padding: theme.spacing(2),
		display: "flex",
		alignItems: "center",
		marginBottom: 12,
		gap: theme.spacing(2),
	},
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
}));

const generateUuid = () => {
	// gerador simples, suficiente para um token de acesso à API interna
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
};

// Chaves numéricas com seus defaults. Servem tanto para inicializar o estado
// local quanto para saber o que gravar quando o campo vem vazio.
const NUMBER_SETTINGS = {
	autoCloseInactiveHours: "0",
	reopenTicketWindowHours: "2",
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

	const isEnabled = key => getSettingValue(key) === "enabled";

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
		try {
			const newToken = generateUuid();
			await api.put("/settings/userApiToken", { value: newToken });
			toast.success(i18n.t("settings.success"));
			onSettingSaved();
		} catch (err) {
			toastError(err);
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

			<Paper className={classes.paper} variant="outlined">
				<TextField
					id="api-token-setting"
					label={i18n.t("settings.settings.apiToken.name")}
					margin="dense"
					variant="outlined"
					fullWidth
					InputProps={{ readOnly: true }}
					value={
						settings && settings.length > 0
							? getSettingValue("userApiToken") || ""
							: ""
					}
				/>
				<Button
					variant="outlined"
					color="primary"
					onClick={handleGenerateToken}
					style={{ whiteSpace: "nowrap" }}
				>
					{i18n.t("settings.settings.apiToken.generate")}
				</Button>
			</Paper>
			<Typography variant="caption" color="textSecondary">
				{i18n.t("settings.settings.apiToken.helper")}
			</Typography>
		</>
	);
};

export { BOOLEAN_SETTINGS, NUMBER_SETTINGS };
export default GeneralTab;
