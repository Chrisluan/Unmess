import React from "react";
import Typography from "@mui/material/Typography";

export default function Title(props) {
	return (
		<Typography
			component="h1"
			sx={{ fontWeight: 700, fontSize: "1.375rem", letterSpacing: "-0.015em", lineHeight: 1.25, color: "text.primary", m: 0 }}
		>
			{props.children}
		</Typography>
	);
}
