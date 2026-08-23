import React from "react";
import Typography from "@mui/material/Typography";

/**
 * Título de página.
 *
 * Preto, e não azul. O azul do sistema marca o que é clicável e o que está
 * ativo; um título pintado com a cor de ação promete uma interação que não
 * existe, e gasta a cor que deveria estar sobrando para os botões.
 *
 * A hierarquia aqui é peso e tamanho, que é o que ela sempre foi.
 */
export default function Title(props) {
	return (
		<Typography variant="h5" color="textPrimary">
			{props.children}
		</Typography>
	);
}
