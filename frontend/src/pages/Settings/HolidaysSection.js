import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import {
    Button,
    Checkbox,
    FormControlLabel,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../../components/ConfirmationModal";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	paper: {
		padding: theme.spacing(2),
		marginTop: theme.spacing(2),
	},
	form: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(2),
		flexWrap: "wrap",
		marginBottom: theme.spacing(2),
	},
	empty: {
		color: theme.palette.text.secondary,
		fontSize: "0.85rem",
	},
}));

const emptyForm = { name: "", date: "", recurring: false };

/**
 * Feriados e exceções. Num feriado a empresa é considerada fechada mesmo que
 * o dia da semana esteja marcado como útil na grade acima.
 */
const HolidaysSection = () => {
	const classes = useStyles();
	const [holidays, setHolidays] = useState([]);
	const [form, setForm] = useState(emptyForm);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(null);

	const fetchHolidays = useCallback(async () => {
		try {
			const { data } = await api.get("/holidays");
			setHolidays(data || []);
		} catch (err) {
			toastError(err);
		}
	}, []);

	useEffect(() => {
		fetchHolidays();
	}, [fetchHolidays]);

	const handleSubmit = async e => {
		e.preventDefault();
		if (!form.name.trim() || !form.date) return;

		setSaving(true);
		try {
			await api.post("/holidays", {
				name: form.name.trim(),
				date: form.date,
				recurring: form.recurring,
			});
			toast.success(i18n.t("settings.holidays.saved"));
			setForm(emptyForm);
			fetchHolidays();
		} catch (err) {
			toastError(err);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		try {
			await api.delete(`/holidays/${deleting.id}`);
			toast.success(i18n.t("settings.holidays.deleted"));
			fetchHolidays();
		} catch (err) {
			toastError(err);
		} finally {
			setDeleting(null);
		}
	};

	const formatDate = holiday => {
		try {
			const parsed = parseISO(holiday.date);
			// Recorrente ignora o ano: mostrar 25/12 evita sugerir que vale
			// só para o ano em que foi cadastrado.
			return format(parsed, holiday.recurring ? "dd/MM" : "dd/MM/yyyy");
		} catch {
			return holiday.date;
		}
	};

	return (
		<Paper className={classes.paper} variant="outlined">
			<ConfirmationModal
				title={deleting ? `${i18n.t("settings.holidays.confirmDelete")} "${deleting.name}"?` : ""}
				open={Boolean(deleting)}
				onClose={() => setDeleting(null)}
				danger
				confirmLabel="Remover feriado"
				onConfirm={handleDelete}
			>
				{i18n.t("settings.holidays.confirmDeleteMessage")}
			</ConfirmationModal>

			<Typography variant="subtitle1">
				{i18n.t("settings.holidays.title")}
			</Typography>
			<Typography variant="body2" color="textSecondary" gutterBottom>
				{i18n.t("settings.holidays.description")}
			</Typography>

			<form className={classes.form} onSubmit={handleSubmit}>
				<TextField
					label={i18n.t("settings.holidays.form.name")}
					variant="outlined"
					margin="dense"
					value={form.name}
					onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
					style={{ flex: 1, minWidth: 180 }}
				/>
				<TextField
					label={i18n.t("settings.holidays.form.date")}
					type="date"
					variant="outlined"
					margin="dense"
					InputLabelProps={{ shrink: true }}
					value={form.date}
					onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
				/>
				<FormControlLabel
					control={
						<Checkbox
							color="primary"
							checked={form.recurring}
							onChange={e =>
								setForm(prev => ({ ...prev, recurring: e.target.checked }))
							}
						/>
					}
					label={i18n.t("settings.holidays.form.recurring")}
				/>
				<Button
					type="submit"
					variant="contained"
					color="primary"
					disabled={saving || !form.name.trim() || !form.date}
				>
					{i18n.t("settings.holidays.form.add")}
				</Button>
			</form>

			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>{i18n.t("settings.holidays.table.name")}</TableCell>
						<TableCell>{i18n.t("settings.holidays.table.date")}</TableCell>
						<TableCell align="right">
							{i18n.t("settings.holidays.table.actions")}
						</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{holidays.map(holiday => (
						<TableRow key={holiday.id}>
							<TableCell>{holiday.name}</TableCell>
							<TableCell>
								{formatDate(holiday)}
								{holiday.recurring &&
									` · ${i18n.t("settings.holidays.everyYear")}`}
							</TableCell>
							<TableCell align="right">
								<IconButton size="small" onClick={() => setDeleting(holiday)}>
									<DeleteOutlineIcon />
								</IconButton>
							</TableCell>
						</TableRow>
					))}
					{holidays.length === 0 && (
						<TableRow>
							<TableCell colSpan={3}>
								<span className={classes.empty}>
									{i18n.t("settings.holidays.empty")}
								</span>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</Paper>
	);
};

export default HolidaysSection;
