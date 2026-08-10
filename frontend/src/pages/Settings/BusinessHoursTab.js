import React, { useEffect, useState } from "react";

import {
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Switch,
    TextField,
    Button,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n.js";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import HolidaysSection from "./HolidaysSection";

const useStyles = makeStyles(theme => ({
	paper: {
		padding: theme.spacing(2),
	},
	saveButton: {
		marginTop: theme.spacing(2),
	},
}));

const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

const buildDefaultDays = () =>
	WEEK_DAYS.map(weekDay => ({
		weekDay,
		enabled: weekDay >= 1 && weekDay <= 5,
		startTime: "08:00",
		endTime: "18:00",
	}));

const BusinessHoursTab = () => {
	const classes = useStyles();
	const [days, setDays] = useState(buildDefaultDays());
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		(async () => {
			try {
				const { data } = await api.get("/business-hours");
				if (data && data.length > 0) {
					const merged = buildDefaultDays().map(defaultDay => {
						const found = data.find(d => d.weekDay === defaultDay.weekDay);
						return found
							? {
									weekDay: found.weekDay,
									enabled: found.enabled,
									startTime: found.startTime,
									endTime: found.endTime,
							  }
							: defaultDay;
					});
					setDays(merged);
				}
			} catch (err) {
				toastError(err);
			}
		})();
	}, []);

	const handleDayChange = (weekDay, field, value) => {
		setDays(prev =>
			prev.map(day => (day.weekDay === weekDay ? { ...day, [field]: value } : day))
		);
	};

	const handleSave = async () => {
		setLoading(true);
		try {
			await api.put("/business-hours", { days });
			toast.success(i18n.t("settings.success"));
		} catch (err) {
			toastError(err);
		}
		setLoading(false);
	};

	return (
		<>
		<Paper className={classes.paper} variant="outlined">
			<Typography variant="body1" gutterBottom>
				{i18n.t("settings.businessHours.description")}
			</Typography>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>{i18n.t("settings.businessHours.table.day")}</TableCell>
						<TableCell align="center">
							{i18n.t("settings.businessHours.table.enabled")}
						</TableCell>
						<TableCell align="center">
							{i18n.t("settings.businessHours.table.start")}
						</TableCell>
						<TableCell align="center">
							{i18n.t("settings.businessHours.table.end")}
						</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{days.map(day => (
						<TableRow key={day.weekDay}>
							<TableCell>
								{i18n.t(`settings.businessHours.weekDays.${day.weekDay}`)}
							</TableCell>
							<TableCell align="center">
								<Switch
									checked={day.enabled}
									onChange={e =>
										handleDayChange(day.weekDay, "enabled", e.target.checked)
									}
									color="primary"
								/>
							</TableCell>
							<TableCell align="center">
								<TextField
									type="time"
									value={day.startTime}
									disabled={!day.enabled}
									onChange={e =>
										handleDayChange(day.weekDay, "startTime", e.target.value)
									}
									size="small"
								/>
							</TableCell>
							<TableCell align="center">
								<TextField
									type="time"
									value={day.endTime}
									disabled={!day.enabled}
									onChange={e =>
										handleDayChange(day.weekDay, "endTime", e.target.value)
									}
									size="small"
								/>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<Button
				variant="contained"
				color="primary"
				className={classes.saveButton}
				onClick={handleSave}
				disabled={loading}
			>
				{i18n.t("settings.buttons.save")}
			</Button>
		</Paper>
		<HolidaysSection />
		</>
	);
};

export default BusinessHoursTab;
