import React from "react";
import PropTypes from "prop-types";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

const useStyles = makeStyles((theme) => ({
  cabecalho: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },

  descricao: {
    maxWidth: 640,
  },

  corpo: {
    flex: 1,
    margin: theme.spacing(0, 2, 2),
    border: `1px solid ${theme.palette.divider}`,
    overflowY: "auto",
    // Sem isto a tabela larga estoura o painel e rola a página inteira.
    overflowX: "auto",
    ...theme.scrollbarStyles,
  },
}));

/**
 * A moldura comum dos módulos financeiros.
 *
 * O Financeiro era uma tela só com quatro abas, e a moldura — container,
 * cabeçalho, painel com rolagem própria — vivia no arquivo dessa tela. Ao
 * separar os módulos, ou a moldura virava isto ou seria copiada cinco vezes,
 * e a quinta cópia já sairia diferente das outras.
 *
 * A descrição de uma linha não é enfeite: "A receber", "A pagar" e "Caixa"
 * são parecidos o bastante para alguém abrir o errado, e o subtítulo é o que
 * confirma, sem clicar em nada, que se chegou onde se queria.
 */
const Shell = ({ titulo, descricao, acoes, children }) => {
  const classes = useStyles();

  return (
    <MainContainer>
      <MainHeader>
        <div className={classes.cabecalho}>
          <Title>{titulo}</Title>
          {descricao && (
            <Typography
              variant="body2"
              color="textSecondary"
              className={classes.descricao}
            >
              {descricao}
            </Typography>
          )}
        </div>
        {acoes && <MainHeaderButtonsWrapper>{acoes}</MainHeaderButtonsWrapper>}
      </MainHeader>

      <Paper square variant="outlined" className={classes.corpo}>
        {children}
      </Paper>
    </MainContainer>
  );
};

Shell.propTypes = {
  titulo: PropTypes.node.isRequired,
  descricao: PropTypes.node,
  acoes: PropTypes.node,
  children: PropTypes.node,
};

export default Shell;
