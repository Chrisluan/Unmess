import React from "react";
import Typography from "@mui/material/Typography";

const Title = props => {
	return (
		<Typography component="h2" sx={{ fontWeight: 600, fontSize: "0.9375rem", color: "text.primary", mb: 1.5 }}>
			{props.children}
		</Typography>
	);
};

export default Title;
