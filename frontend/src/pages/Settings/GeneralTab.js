import React from "react";

import { Paper, Typography, TextField, Button, makeStyles } from "@material-ui/core";
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
}));

const generateUuid = () => {
	// gerador simples, suficiente para um token de acesso à API interna
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
};

const GeneralTab = ({ settings, getSettingValue, onSettingSaved }) => {
	const classes = useStyles();

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

	return (
		<>
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

export default GeneralTab;
