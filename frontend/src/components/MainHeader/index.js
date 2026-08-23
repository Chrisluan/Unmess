import React from "react";

import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles(theme => ({
	/**
	 * Cabeçalho das telas de listagem.
	 *
	 * A borda de baixo separa o título e os botões do conteúdo que vem
	 * depois. Sem ela, a tabela começava encostada no título e as duas coisas
	 * liam como um bloco só — e num tema de canto reto, que não usa sombra
	 * para separar nada, a borda é a única marcação disponível.
	 */
	contactsHeader: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: theme.spacing(1, 2),
		padding: theme.spacing(2, 2, 1.5),
		borderBottom: `1px solid ${theme.palette.divider}`,
	},
}));

const MainHeader = ({ children }) => {
	const classes = useStyles();

	return <div className={classes.contactsHeader}>{children}</div>;
};

export default MainHeader;
