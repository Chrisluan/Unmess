import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";
import FormGroup from "@material-ui/core/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";

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
}));

const PermissionGroupSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(100, "Too Long!")
		.required("Required"),
});

const PermissionGroupModal = ({ open, onClose, permissionGroupId }) => {
	const classes = useStyles();

	const initialState = { name: "" };

	const [group, setGroup] = useState(initialState);
	const [availablePermissions, setAvailablePermissions] = useState([]);
	const [selectedPermissions, setSelectedPermissions] = useState([]);

	useEffect(() => {
		(async () => {
			try {
				const { data } = await api.get("/permission-groups/available");
				setAvailablePermissions(data);
			} catch (err) {
				toastError(err);
			}
		})();
	}, []);

	useEffect(() => {
		(async () => {
			if (!permissionGroupId) return;
			try {
				const { data } = await api.get(
					`/permission-groups/${permissionGroupId}`
				);
				setGroup({ name: data.name });
				setSelectedPermissions(JSON.parse(data.permissions || "[]"));
			} catch (err) {
				toastError(err);
			}
		})();

		return () => {
			setGroup(initialState);
			setSelectedPermissions([]);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [permissionGroupId, open]);

	const handleClose = () => {
		onClose();
		setGroup(initialState);
		setSelectedPermissions([]);
	};

	const handleTogglePermission = permission => {
		setSelectedPermissions(prev =>
			prev.includes(permission)
				? prev.filter(p => p !== permission)
				: [...prev, permission]
		);
	};

	const handleSaveGroup = async values => {
		try {
			const payload = { ...values, permissions: selectedPermissions };
			if (permissionGroupId) {
				await api.put(`/permission-groups/${permissionGroupId}`, payload);
			} else {
				await api.post("/permission-groups", payload);
			}
			toast.success(i18n.t("permissionGroupModal.success"));
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
					{permissionGroupId
						? i18n.t("permissionGroupModal.title.edit")
						: i18n.t("permissionGroupModal.title.add")}
				</DialogTitle>
				<Formik
					initialValues={group}
					enableReinitialize={true}
					validationSchema={PermissionGroupSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveGroup(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting }) => (
						<Form>
							<DialogContent dividers>
								<Field
									as={TextField}
									label={i18n.t("permissionGroupModal.form.name")}
									autoFocus
									name="name"
									error={touched.name && Boolean(errors.name)}
									helperText={touched.name && errors.name}
									variant="outlined"
									margin="dense"
									fullWidth
								/>

								<Typography
									variant="subtitle2"
									gutterBottom
									style={{ marginTop: 16 }}
								>
									{i18n.t("permissionGroupModal.form.permissions")}
								</Typography>
								<FormGroup>
									{availablePermissions.map(permission => (
										<FormControlLabel
											key={permission}
											control={
												<Checkbox
													checked={selectedPermissions.includes(permission)}
													onChange={() => handleTogglePermission(permission)}
													color="primary"
												/>
											}
											label={i18n.t(
												`permissionGroupModal.permissions.${permission}`
											)}
										/>
									))}
								</FormGroup>
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("permissionGroupModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{permissionGroupId
										? i18n.t("permissionGroupModal.buttons.okEdit")
										: i18n.t("permissionGroupModal.buttons.okAdd")}
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

export default PermissionGroupModal;
