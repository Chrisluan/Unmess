import React from "react";

import makeStyles from '@mui/styles/makeStyles';
import Skeleton from '@mui/material/Skeleton';

const useStyles = makeStyles(theme => ({
	ticketHeader: {
		display: "flex",
		alignItems: "center",
		gap: 12,
		minHeight: 72,
		padding: theme.spacing(1, 2.5),
		flex: "none",
		backgroundColor: theme.palette.unmess.superficie,
		borderBottom: `1px solid ${theme.palette.unmess.linha}`,
	},
}));

const TicketHeaderSkeleton = () => {
	const classes = useStyles();

	return (
		<header className={classes.ticketHeader}>
			<Skeleton animation="wave" variant="circular" width={44} height={44} />
			<div>
				<Skeleton animation="wave" width={140} />
				<Skeleton animation="wave" width={200} />
			</div>
		</header>
	);
};

export default TicketHeaderSkeleton;
