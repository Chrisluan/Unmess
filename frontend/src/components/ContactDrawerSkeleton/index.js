import React from "react";
import Skeleton from '@mui/material/Skeleton';

const ContactDrawerSkeleton = () => {
	return (
		<div style={{ padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
			<Skeleton animation="wave" variant="circular" width={72} height={72} />
			<Skeleton animation="wave" height={24} width={140} />
			<Skeleton animation="wave" height={20} width={110} />
			<Skeleton animation="wave" variant="rounded" height={90} width="100%" style={{ marginTop: 16 }} />
			<Skeleton animation="wave" variant="rounded" height={90} width="100%" />
		</div>
	);
};

export default ContactDrawerSkeleton;
