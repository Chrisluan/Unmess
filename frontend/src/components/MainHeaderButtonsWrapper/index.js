import React from "react";

import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles(theme => ({
	MainHeaderButtonsWrapper: {
		flex: "none",
		marginLeft: "auto",
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: theme.spacing(1),
		"& .MuiTextField-root": {
			minWidth: 240,
		},
		[theme.breakpoints.down("sm")]: {
			marginLeft: 0,
			width: "100%",
			"& .MuiTextField-root": { flex: 1, minWidth: 0 },
		},
	},
}));

const MainHeaderButtonsWrapper = ({ children }) => {
	const classes = useStyles();

	return <div className={classes.MainHeaderButtonsWrapper}>{children}</div>;
};

export default MainHeaderButtonsWrapper;
