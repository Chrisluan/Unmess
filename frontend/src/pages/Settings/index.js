import React, { useState, useEffect, useCallback } from "react";
import openSocket from "../../services/socket-io";

import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Box from "@material-ui/core/Box";

import api from "../../services/api";
import { i18n } from "../../translate/i18n.js";
import toastError from "../../errors/toastError";

import GeneralTab from "./GeneralTab";
import BusinessHoursTab from "./BusinessHoursTab";
import TicketStatusesTab from "./TicketStatusesTab";
import AutoMessagesTab from "./AutoMessagesTab";

const useStyles = makeStyles(theme => ({
	root: {
		padding: theme.spacing(4),
	},
	tabPanel: {
		paddingTop: theme.spacing(3),
	},
}));

const Settings = () => {
	const classes = useStyles();

	const [settings, setSettings] = useState([]);
	const [tab, setTab] = useState(0);

	const fetchSettings = useCallback(async () => {
		try {
			const { data } = await api.get("/settings");
			setSettings(data || []);
		} catch (err) {
			toastError(err);
		}
	}, []);

	useEffect(() => {
		fetchSettings();
	}, [fetchSettings]);

	useEffect(() => {
		const socket = openSocket();

		socket.on("settings", data => {
			if (data.action === "update") {
				setSettings(prevState => {
					const aux = [...prevState];
					const settingIndex = aux.findIndex(s => s.key === data.setting.key);
					if (settingIndex !== -1) {
						aux[settingIndex] = { ...aux[settingIndex], value: data.setting.value };
					} else {
						aux.push(data.setting);
					}
					return aux;
				});
			}
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	// Nunca lança erro mesmo se a chave ainda não existir no banco para esta
	// empresa (ex: primeira vez que a tela é aberta, antes de qualquer save).
	const getSettingValue = key => {
		const setting = settings.find(s => s.key === key);
		return setting ? setting.value : "";
	};

	return (
		<div className={classes.root}>
			<Container maxWidth="md">
				<Tabs
					value={tab}
					onChange={(e, value) => setTab(value)}
					indicatorColor="primary"
					textColor="primary"
					variant="scrollable"
					scrollButtons="auto"
				>
					<Tab label={i18n.t("settings.tabs.general")} />
					<Tab label={i18n.t("settings.tabs.businessHours")} />
					<Tab label={i18n.t("settings.tabs.ticketStatuses")} />
					<Tab label={i18n.t("settings.tabs.autoMessages")} />
				</Tabs>

				<Box className={classes.tabPanel} hidden={tab !== 0}>
					<GeneralTab
						settings={settings}
						getSettingValue={getSettingValue}
						onSettingSaved={fetchSettings}
					/>
				</Box>
				<Box className={classes.tabPanel} hidden={tab !== 1}>
					<BusinessHoursTab />
				</Box>
				<Box className={classes.tabPanel} hidden={tab !== 2}>
					<TicketStatusesTab />
				</Box>
				<Box className={classes.tabPanel} hidden={tab !== 3}>
					<AutoMessagesTab
						settings={settings}
						getSettingValue={getSettingValue}
						onSettingSaved={fetchSettings}
					/>
				</Box>
			</Container>
		</div>
	);
};

export default Settings;
