import React from "react";

import { Paper, Typography, TextField, Switch, FormControlLabel, Chip } from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n.js";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	paper: {
		padding: theme.spacing(2),
		marginBottom: theme.spacing(2),
	},
	variablesWrapper: {
		marginTop: theme.spacing(1),
		marginBottom: theme.spacing(1),
		display: "flex",
		flexWrap: "wrap",
		gap: theme.spacing(1),
	},
}));

const VARIABLES = [
	"{{cliente.nome}}",
	"{{cliente.numero}}",
	"{{setor}}",
	"{{atendente}}",
	"{{protocolo}}",
];

const VariablesHelper = () => {
	const classes = useStyles();
	return (
		<div className={classes.variablesWrapper}>
			{VARIABLES.map(v => (
				<Chip key={v} label={v} size="small" variant="outlined" />
			))}
		</div>
	);
};

const AutoMessagesTab = ({ settings, getSettingValue, onSettingSaved }) => {
	const classes = useStyles();

	const handleToggle = async (key, checked) => {
		try {
			await api.put(`/settings/${key}`, {
				value: checked ? "enabled" : "disabled",
			});
			toast.success(i18n.t("settings.success"));
			onSettingSaved();
		} catch (err) {
			toastError(err);
		}
	};

	const handleTextBlur = async (key, value) => {
		try {
			await api.put(`/settings/${key}`, { value });
			toast.success(i18n.t("settings.success"));
			onSettingSaved();
		} catch (err) {
			toastError(err);
		}
	};

	const isEnabled = key => getSettingValue(key) === "enabled";

	return (
		<>
			<Paper className={classes.paper} variant="outlined">
				<FormControlLabel
					control={
						<Switch
							checked={isEnabled("outOfHoursMessageEnabled")}
							onChange={e =>
								handleToggle("outOfHoursMessageEnabled", e.target.checked)
							}
							color="primary"
						/>
					}
					label={i18n.t("settings.autoMessages.outOfHours.toggle")}
				/>
				<Typography variant="body2" color="textSecondary">
					{i18n.t("settings.autoMessages.outOfHours.description")}
				</Typography>
				<VariablesHelper />
				<TextField
					multiline
					minRows={3}
					fullWidth
					variant="outlined"
					margin="dense"
					defaultValue={getSettingValue("outOfHoursMessage") || ""}
					onBlur={e => handleTextBlur("outOfHoursMessage", e.target.value)}
					placeholder={i18n.t("settings.autoMessages.outOfHours.placeholder")}
				/>
			</Paper>

			<Paper className={classes.paper} variant="outlined">
				<FormControlLabel
					control={
						<Switch
							checked={isEnabled("transferMessageEnabled")}
							onChange={e =>
								handleToggle("transferMessageEnabled", e.target.checked)
							}
							color="primary"
						/>
					}
					label={i18n.t("settings.autoMessages.transfer.toggle")}
				/>
				<Typography variant="body2" color="textSecondary">
					{i18n.t("settings.autoMessages.transfer.description")}
				</Typography>
				<VariablesHelper />
				<TextField
					multiline
					minRows={3}
					fullWidth
					variant="outlined"
					margin="dense"
					defaultValue={getSettingValue("transferMessage") || ""}
					onBlur={e => handleTextBlur("transferMessage", e.target.value)}
					placeholder={i18n.t("settings.autoMessages.transfer.placeholder")}
				/>
			</Paper>
		</>
	);
};

export default AutoMessagesTab;
