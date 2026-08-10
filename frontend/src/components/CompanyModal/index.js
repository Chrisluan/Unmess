import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import makeStyles from '@mui/styles/makeStyles';
import { green } from "@mui/material/colors";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	textField: {
		marginRight: theme.spacing(1),
		flex: 1,
	},
	extraAttr: {
		display: "flex",
		flexWrap: "wrap",
	},
	btnWrapper: {
		position: "relative",
	},
	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
	formControl: {
		margin: theme.spacing(1),
		minWidth: 120,
	},
}));

const CompanySchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(100, "Too Long!")
		.required("Required"),
	document: Yup.string(),
	email: Yup.string().email("Invalid email"),
	phone: Yup.string(),
	plan: Yup.string(),
	status: Yup.string(),
	adminName: Yup.string().when("$isEdit", {
		is: false,
		then: Yup.string().min(2, "Too Short!").required("Required"),
	}),
	adminEmail: Yup.string().when("$isEdit", {
		is: false,
		then: Yup.string().email("Invalid email").required("Required"),
	}),
	adminPassword: Yup.string().when("$isEdit", {
		is: false,
		then: Yup.string().min(5, "Too Short!").required("Required"),
	}),
});

const CompanyModal = ({ open, onClose, companyId }) => {
	const classes = useStyles();

	const isEdit = Boolean(companyId);

	const initialState = {
		name: "",
		document: "",
		email: "",
		phone: "",
		plan: "basic",
		status: "active",
		adminName: "",
		adminEmail: "",
		adminPassword: "",
	};

	const [company, setCompany] = useState(initialState);

	useEffect(() => {
		(async () => {
			if (!companyId) return;
			try {
				const { data } = await api.get(`/companies/${companyId}`);
				setCompany(prevState => {
					return { ...prevState, ...data };
				});
			} catch (err) {
				toastError(err);
			}
		})();

		return () => {
			setCompany(initialState);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [companyId, open]);

	const handleClose = () => {
		onClose();
		setCompany(initialState);
	};

	const handleSaveCompany = async values => {
		try {
			if (companyId) {
				await api.put(`/companies/${companyId}`, values);
				toast.success(i18n.t("companyModal.success"));
			} else {
				await api.post("/companies", values);
				toast.success(i18n.t("companyModal.success"));
			}
			handleClose();
		} catch (err) {
			toastError(err);
		}
	};

	return (
		<div className={classes.root}>
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="sm"
				fullWidth
				scroll="paper"
			>
				<DialogTitle>
					{companyId
						? `${i18n.t("companyModal.title.edit")}`
						: `${i18n.t("companyModal.title.add")}`}
				</DialogTitle>
				<Formik
					initialValues={company}
					enableReinitialize={true}
					validationSchema={CompanySchema}
					validationContext={{ isEdit }}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveCompany(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting }) => (
						<Form>
							<DialogContent dividers>
								<Typography variant="subtitle2" gutterBottom>
									{i18n.t("companyModal.form.companyData")}
								</Typography>
								<div className={classes.extraAttr}>
									<Field
										as={TextField}
										label={i18n.t("companyModal.form.name")}
										autoFocus
										name="name"
										error={touched.name && Boolean(errors.name)}
										helperText={touched.name && errors.name}
										variant="outlined"
										margin="dense"
										className={classes.textField}
									/>
									<Field
										as={TextField}
										label={i18n.t("companyModal.form.document")}
										name="document"
										error={touched.document && Boolean(errors.document)}
										helperText={touched.document && errors.document}
										variant="outlined"
										margin="dense"
										className={classes.textField}
									/>
								</div>
								<div className={classes.extraAttr}>
									<Field
										as={TextField}
										label={i18n.t("companyModal.form.email")}
										name="email"
										error={touched.email && Boolean(errors.email)}
										helperText={touched.email && errors.email}
										variant="outlined"
										margin="dense"
										className={classes.textField}
									/>
									<Field
										as={TextField}
										label={i18n.t("companyModal.form.phone")}
										name="phone"
										error={touched.phone && Boolean(errors.phone)}
										helperText={touched.phone && errors.phone}
										variant="outlined"
										margin="dense"
										className={classes.textField}
									/>
								</div>
								<div className={classes.extraAttr}>
									<Field
										as={TextField}
										select
										label={i18n.t("companyModal.form.plan")}
										name="plan"
										variant="outlined"
										margin="dense"
										className={classes.textField}
									>
										<MenuItem value="basic">
											{i18n.t("companyModal.form.planBasic")}
										</MenuItem>
										<MenuItem value="pro">
											{i18n.t("companyModal.form.planPro")}
										</MenuItem>
										<MenuItem value="enterprise">
											{i18n.t("companyModal.form.planEnterprise")}
										</MenuItem>
									</Field>
									<Field
										as={TextField}
										select
										label={i18n.t("companyModal.form.status")}
										name="status"
										variant="outlined"
										margin="dense"
										className={classes.textField}
									>
										<MenuItem value="active">
											{i18n.t("companyModal.form.statusActive")}
										</MenuItem>
										<MenuItem value="suspended">
											{i18n.t("companyModal.form.statusSuspended")}
										</MenuItem>
										<MenuItem value="canceled">
											{i18n.t("companyModal.form.statusCanceled")}
										</MenuItem>
									</Field>
								</div>

								{!isEdit && (
									<>
										<Typography variant="subtitle2" gutterBottom style={{ marginTop: 16 }}>
											{i18n.t("companyModal.form.adminData")}
										</Typography>
										<div className={classes.extraAttr}>
											<Field
												as={TextField}
												label={i18n.t("companyModal.form.adminName")}
												name="adminName"
												error={touched.adminName && Boolean(errors.adminName)}
												helperText={touched.adminName && errors.adminName}
												variant="outlined"
												margin="dense"
												className={classes.textField}
											/>
										</div>
										<div className={classes.extraAttr}>
											<Field
												as={TextField}
												label={i18n.t("companyModal.form.adminEmail")}
												name="adminEmail"
												error={touched.adminEmail && Boolean(errors.adminEmail)}
												helperText={touched.adminEmail && errors.adminEmail}
												variant="outlined"
												margin="dense"
												className={classes.textField}
											/>
											<Field
												as={TextField}
												label={i18n.t("companyModal.form.adminPassword")}
												name="adminPassword"
												type="password"
												error={
													touched.adminPassword && Boolean(errors.adminPassword)
												}
												helperText={
													touched.adminPassword && errors.adminPassword
												}
												variant="outlined"
												margin="dense"
												className={classes.textField}
											/>
										</div>
									</>
								)}
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("companyModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{companyId
										? i18n.t("companyModal.buttons.okEdit")
										: i18n.t("companyModal.buttons.okAdd")}
									{isSubmitting && (
										<CircularProgress
											size={24}
											className={classes.buttonProgress}
										/>
									)}
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default CompanyModal;
