import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import {
    Button,
    Chip,
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
import EditIcon from "@mui/icons-material/Edit";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../../components/ConfirmationModal";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	form: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(2),
		padding: theme.spacing(2),
		marginBottom: theme.spacing(2),
	},
	colorInput: {
		width: 56,
		height: 40,
		padding: 0,
		border: "none",
		background: "none",
		cursor: "pointer",
	},
	paper: {
		padding: theme.spacing(1),
	},
}));

const emptyForm = { id: null, name: "", color: "#2ecc71" };

const TagsTab = () => {
	const classes = useStyles();
	const [tags, setTags] = useState([]);
	const [form, setForm] = useState(emptyForm);
	const [saving, setSaving] = useState(false);
	const [deletingTag, setDeletingTag] = useState(null);

	const fetchTags = useCallback(async () => {
		try {
			const { data } = await api.get("/tags");
			setTags(data || []);
		} catch (err) {
			toastError(err);
		}
	}, []);

	useEffect(() => {
		fetchTags();
	}, [fetchTags]);

	const handleSubmit = async e => {
		e.preventDefault();
		if (!form.name.trim()) return;

		setSaving(true);
		try {
			if (form.id) {
				await api.put(`/tags/${form.id}`, {
					name: form.name.trim(),
					color: form.color,
				});
			} else {
				await api.post("/tags", {
					name: form.name.trim(),
					color: form.color,
				});
			}
			toast.success(i18n.t("tags.saved"));
			setForm(emptyForm);
			fetchTags();
		} catch (err) {
			toastError(err);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		try {
			await api.delete(`/tags/${deletingTag.id}`);
			toast.success(i18n.t("tags.deleted"));
			fetchTags();
		} catch (err) {
			toastError(err);
		} finally {
			setDeletingTag(null);
		}
	};

	return (
		<>
			<ConfirmationModal
				title={
					deletingTag ? `${i18n.t("tags.confirmDelete")} "${deletingTag.name}"?` : ""
				}
				open={Boolean(deletingTag)}
				onClose={() => setDeletingTag(null)}
				onConfirm={handleDelete}
			>
				{i18n.t("tags.confirmDeleteMessage")}
			</ConfirmationModal>

			<Typography variant="body2" color="textSecondary" gutterBottom>
				{i18n.t("tags.description")}
			</Typography>

			<Paper className={classes.form} variant="outlined" component="form" onSubmit={handleSubmit}>
				<TextField
					label={i18n.t("tags.form.name")}
					variant="outlined"
					margin="dense"
					value={form.name}
					onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
					inputProps={{ maxLength: 40 }}
					fullWidth
				/>
				<input
					type="color"
					className={classes.colorInput}
					value={form.color}
					onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
					title={i18n.t("tags.form.color")}
				/>
				<Button
					type="submit"
					variant="contained"
					color="primary"
					disabled={saving || !form.name.trim()}
					style={{ whiteSpace: "nowrap" }}
				>
					{form.id ? i18n.t("tags.form.save") : i18n.t("tags.form.add")}
				</Button>
				{form.id && (
					<Button onClick={() => setForm(emptyForm)} variant="outlined">
						{i18n.t("tags.form.cancel")}
					</Button>
				)}
			</Paper>

			<Paper className={classes.paper} variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>{i18n.t("tags.table.tag")}</TableCell>
							<TableCell align="right">{i18n.t("tags.table.actions")}</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{tags.map(tag => (
							<TableRow key={tag.id}>
								<TableCell>
									<Chip
										size="small"
										label={tag.name}
										style={{ backgroundColor: tag.color, color: "#fff" }}
									/>
								</TableCell>
								<TableCell align="right">
									<IconButton size="small" onClick={() => setForm(tag)}>
										<EditIcon />
									</IconButton>
									<IconButton size="small" onClick={() => setDeletingTag(tag)}>
										<DeleteOutlineIcon />
									</IconButton>
								</TableCell>
							</TableRow>
						))}
						{tags.length === 0 && (
							<TableRow>
								<TableCell colSpan={2}>
									<Typography variant="body2" color="textSecondary">
										{i18n.t("tags.empty")}
									</Typography>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</Paper>
		</>
	);
};

export default TagsTab;
