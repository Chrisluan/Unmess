import React, { useEffect, useState } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	TextField,
	Select,
	MenuItem,
	InputLabel,
	FormControl,
	FormControlLabel,
	Checkbox,
	makeStyles,
} from "@material-ui/core";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	multFieldLine: {
		display: "flex",
		"& > *:not(:last-child)": {
			marginRight: theme.spacing(1),
		},
	},
}));

const TicketStatusSchema = Yup.object().shape({
	name: Yup.string().min(2, "Too Short!").required("Required"),
});

const TicketStatusModal = ({ open, onClose, ticketStatus }) => {
	const classes = useStyles();

	const initialState = {
		name: "",
		color: "#546E7A",
		type: "closed",
	};

	const [status, setStatus] = useState(initialState);
	const [isDefault, setIsDefault] = useState(false);

	useEffect(() => {
		if (ticketStatus) {
			setStatus({
				name: ticketStatus.name,
				color: ticketStatus.color || "#546E7A",
				type: ticketStatus.type,
			});
			setIsDefault(ticketStatus.isDefault);
		} else {
			setStatus(initialState);
			setIsDefault(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ticketStatus, open]);

	const handleClose = () => {
		onClose();
	};

	const handleSave = async values => {
		try {
			const payload = { ...values, isDefault };
			if (ticketStatus) {
				await api.put(`/ticket-statuses/${ticketStatus.id}`, payload);
			} else {
				await api.post("/ticket-statuses", payload);
			}
			toast.success(i18n.t("settings.ticketStatuses.success"));
			handleClose();
		} catch (err) {
			toastError(err);
		}
	};

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
			<DialogTitle>
				{ticketStatus
					? i18n.t("settings.ticketStatuses.modal.title.edit")
					: i18n.t("settings.ticketStatuses.modal.title.add")}
			</DialogTitle>
			<Formik
				initialValues={status}
				enableReinitialize
				validationSchema={TicketStatusSchema}
				onSubmit={(values, actions) => {
					setTimeout(() => {
						handleSave(values);
						actions.setSubmitting(false);
					}, 300);
				}}
			>
				{({ touched, errors, values }) => (
					<Form>
						<DialogContent dividers>
							<Field
								as={TextField}
								label={i18n.t("settings.ticketStatuses.modal.name")}
								name="name"
								autoFocus
								error={touched.name && Boolean(errors.name)}
								helperText={touched.name && errors.name}
								variant="outlined"
								margin="dense"
								fullWidth
							/>
							<div className={classes.multFieldLine}>
								<Field
									as={TextField}
									label={i18n.t("settings.ticketStatuses.modal.color")}
									name="color"
									type="color"
									variant="outlined"
									margin="dense"
								/>
								<FormControl variant="outlined" margin="dense" fullWidth>
									<InputLabel>
										{i18n.t("settings.ticketStatuses.modal.type")}
									</InputLabel>
									<Field
										as={Select}
										name="type"
										label={i18n.t("settings.ticketStatuses.modal.type")}
									>
										<MenuItem value="pending">
											{i18n.t("settings.ticketStatuses.types.pending")}
										</MenuItem>
										<MenuItem value="open">
											{i18n.t("settings.ticketStatuses.types.open")}
										</MenuItem>
										<MenuItem value="closed">
											{i18n.t("settings.ticketStatuses.types.closed")}
										</MenuItem>
									</Field>
								</FormControl>
							</div>
							<FormControlLabel
								control={
									<Checkbox
										checked={isDefault}
										onChange={e => setIsDefault(e.target.checked)}
										color="primary"
									/>
								}
								label={i18n.t("settings.ticketStatuses.modal.isDefault")}
							/>
						</DialogContent>
						<DialogActions>
							<Button onClick={handleClose} color="secondary" variant="outlined">
								{i18n.t("settings.ticketStatuses.buttons.cancel")}
							</Button>
							<Button type="submit" color="primary" variant="contained">
								{ticketStatus
									? i18n.t("settings.ticketStatuses.buttons.okEdit")
									: i18n.t("settings.ticketStatuses.buttons.okAdd")}
							</Button>
						</DialogActions>
					</Form>
				)}
			</Formik>
		</Dialog>
	);
};

export default TicketStatusModal;
