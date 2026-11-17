import React, { useState } from "react";

import * as Yup from "yup";
import { useHistory } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";

import {
	Button,
	CssBaseline,
	TextField,
	Grid,
	Typography,
	InputAdornment,
	IconButton,
	Link,
	CircularProgress
} from '@mui/material';

import { Visibility, VisibilityOff } from '@mui/icons-material';

import makeStyles from '@mui/styles/makeStyles';

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";

// const Copyright = () => {
// 	return (
// 		<Typography variant="body2" color="textSecondary" align="center">
// 			{"Copyleft "}
// 			<Link color="inherit" href="https://github.com/canove">
// 				Canove
// 			</Link>{" "}
// 			{new Date().getFullYear()}
// 			{"."}
// 		</Typography>
// 	);
// };

const useStyles = makeStyles(theme => ({
	/**
	 * Mesmo cartão da tela de entrada.
	 *
	 * Entrar e cadastrar-se são a mesma porta vista de dois lados; molduras
	 * diferentes fariam parecer que uma delas é de outro sistema.
	 */
	tela: {
		minHeight: "100vh",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: theme.spacing(3),
		backgroundColor: theme.palette.background.default,
	},
	paper: {
		width: "100%",
		maxWidth: 380,
		padding: theme.spacing(4),
		backgroundColor: theme.palette.background.paper,
		border: `1px solid ${theme.palette.divider}`,
	},
	titulo: {
		fontWeight: 700,
		letterSpacing: "-0.02em",
		marginBottom: theme.spacing(3),
	},
	submit: {
		margin: theme.spacing(3, 0, 0),
		minHeight: 42,
	},
	rodape: {
		marginTop: theme.spacing(3),
		paddingTop: theme.spacing(2),
		borderTop: `1px solid ${theme.palette.divider}`,
		textAlign: "center",
	},
}));

const UserSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
	email: Yup.string().email("Invalid email").required("Required"),
});

const SignUp = () => {
	const classes = useStyles();
	const history = useHistory();

	const initialState = { name: "", email: "", password: "" };
	const [showPassword, setShowPassword] = useState(false);
	const [user] = useState(initialState);

	const handleSignUp = async values => {
		try {
			await api.post("/auth/signup", values);
			toast.success(i18n.t("signup.toasts.success"));
			history.push("/login");
		} catch (err) {
			toastError(err);
		}
	};

	return (
        <div className={classes.tela}>
            <CssBaseline />
            <div className={classes.paper}>
				<Typography component="h1" variant="h5" className={classes.titulo}>
					{i18n.t("signup.title")}
				</Typography>
				{/* <form className={classes.form} noValidate onSubmit={handleSignUp}> */}
				<Formik
					initialValues={user}
					enableReinitialize={true}
					validationSchema={UserSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSignUp(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting }) => (
						<Form className={classes.form}>
							<Grid container spacing={2}>
								<Grid item xs={12}>
									<Field
										as={TextField}
										autoComplete="name"
										name="name"
										error={touched.name && Boolean(errors.name)}
										helperText={touched.name && errors.name}
										variant="outlined"
										fullWidth
										id="name"
										label={i18n.t("signup.form.name")}
										autoFocus
									/>
								</Grid>

								<Grid item xs={12}>
									<Field
										as={TextField}
										variant="outlined"
										fullWidth
										id="email"
										label={i18n.t("signup.form.email")}
										name="email"
										error={touched.email && Boolean(errors.email)}
										helperText={touched.email && errors.email}
										autoComplete="email"
									/>
								</Grid>
								<Grid item xs={12}>
									<Field
										as={TextField}
										variant="outlined"
										fullWidth
										name="password"
										id="password"
										autoComplete="new-password"
										error={touched.password && Boolean(errors.password)}
										helperText={touched.password && errors.password}
										label={i18n.t("signup.form.password")}
										type={showPassword ? 'text' : 'password'}
										InputProps={{
											endAdornment: (
												<InputAdornment position="end">
													<IconButton
                                                        aria-label={
                                                            showPassword
                                                                ? i18n.t("userModal.form.hidePassword")
                                                                : i18n.t("userModal.form.showPassword")
                                                        }
                                                        onClick={() => setShowPassword((e) => !e)}
                                                        size="large">
														{showPassword ? <VisibilityOff /> : <Visibility />}
													</IconButton>
												</InputAdornment>
											)
										}}
									/>
								</Grid>
							</Grid>
							<Button
								type="submit"
								fullWidth
								variant="contained"
								color="primary"
								className={classes.submit}
								disabled={isSubmitting}
								startIcon={
									isSubmitting ? (
										<CircularProgress size={16} color="inherit" />
									) : null
								}
							>
								{i18n.t("signup.buttons.submit")}
							</Button>
							<div className={classes.rodape}>
								<Link
									variant="body2"
									component={RouterLink}
									to="/login"
								>
									{i18n.t("signup.buttons.login")}
								</Link>
							</div>
						</Form>
					)}
				</Formik>
			</div>
        </div>
    );
};

export default SignUp;
