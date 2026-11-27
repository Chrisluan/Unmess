import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";

import makeStyles from "@mui/styles/makeStyles";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";

import Janela from "../Janela";

/**
 * Explica por que uma configuração não foi gravada.
 *
 * O backend recusa (409, ERR_CONFIGURACAO_INCONSISTENTE) a mudança que
 * deixaria outro recurso sem efeito, e manda a lista do que falta. Um aviso
 * de canto de tela não caberia: a pessoa precisa ler o motivo e ter o botão
 * que leva até onde se resolve.
 *
 * Fica montado uma vez, perto da raiz, e escuta um evento: `toastError`
 * dispara o evento quando encontra esse erro, de qualquer tela.
 */
export const EVENTO_CONFLITO = "unmess:configuracao-inconsistente";

export const avisarConflito = (problemas) =>
  window.dispatchEvent(new CustomEvent(EVENTO_CONFLITO, { detail: problemas }));

const useStyles = makeStyles((theme) => ({
  item: {
    padding: theme.spacing(1.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:last-child": { borderBottom: "none" },
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    alignItems: "flex-start",
  },
}));

const ConflitoDeConfiguracao = () => {
  const classes = useStyles();
  const history = useHistory();
  const [problemas, setProblemas] = useState([]);

  useEffect(() => {
    const aoReceber = (evento) => setProblemas(evento.detail || []);
    window.addEventListener(EVENTO_CONFLITO, aoReceber);
    return () => window.removeEventListener(EVENTO_CONFLITO, aoReceber);
  }, []);

  const fechar = () => setProblemas([]);

  const resolver = (rota) => {
    fechar();
    history.push(rota);
  };

  return (
    <Janela
      open={problemas.length > 0}
      onClose={fechar}
      titulo="A alteração não foi salva"
      subtitulo="Ela deixaria outra configuração sem efeito. Resolva o ponto abaixo e tente de novo."
      icone={<RuleOutlinedIcon />}
      tom="atencao"
      rotuloCancelar="Fechar"
    >
      {problemas.map((p) => (
        <div key={`${p.regra}-${p.mensagem}`} className={classes.item}>
          <Typography variant="subtitle2">{p.titulo}</Typography>
          <Typography variant="body2" color="text.secondary">
            {p.mensagem}
          </Typography>
          {p.resolver?.rota && (
            <Button size="small" variant="outlined" onClick={() => resolver(p.resolver.rota)}>
              {p.resolver.rotulo}
            </Button>
          )}
        </div>
      ))}
    </Janela>
  );
};

export default ConflitoDeConfiguracao;
