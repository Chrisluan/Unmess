import React from "react";
import Skeleton from '@mui/material/Skeleton';
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import { i18n } from "../../translate/i18n";

const ContactDrawerSkeleton = ({ classes }) => {
	return (
        <div className={classes.content}>
            <Paper square variant="outlined" className={classes.contactHeader}>
				<Skeleton
					animation="wave"
					variant="circular"
					width={56}
					height={56}
				/>
				<div style={{ flex: 1 }}>
					<Skeleton animation="wave" height={20} width="70%" />
					<Skeleton animation="wave" height={18} width="45%" />
				</div>
			</Paper>
            <Paper square className={classes.contactDetails}>
				<Typography variant="subtitle1">
					{i18n.t("contactDrawer.extraInfo")}
				</Typography>
				<Paper square variant="outlined" className={classes.contactExtraInfo}>
					<Skeleton animation="wave" height={20} width={60} />
					<Skeleton animation="wave" height={20} width={160} />
				</Paper>
				<Paper square variant="outlined" className={classes.contactExtraInfo}>
					<Skeleton animation="wave" height={20} width={60} />
					<Skeleton animation="wave" height={20} width={160} />
				</Paper>
				<Paper square variant="outlined" className={classes.contactExtraInfo}>
					<Skeleton animation="wave" height={20} width={60} />
					<Skeleton animation="wave" height={20} width={160} />
				</Paper>
			</Paper>
        </div>
    );
};

export default ContactDrawerSkeleton;
