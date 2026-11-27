import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { Box, Paper, TextField, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(3),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
  grade: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(2),
    [theme.breakpoints.down("sm")]: { gridTemplateColumns: "1fr" },
  },
}));

const CAMPOS = [
  { chave: "legalName", rotulo: "Razão social" },
  { chave: "document", rotulo: "CNPJ ou CPF" },
  { chave: "phone", rotulo: "Telefone" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "address", rotulo: "Endereço completo", inteiro: true },
];

/**
 * Os dados que saem no cabeçalho da proposta, da ordem de produção e da
 * cobrança. Sem eles o cliente recebe uma proposta sem CNPJ nem endereço de
 * quem está vendendo.
 */
const DadosDaEmpresa = () => {
  const classes = useStyles();
  const [dados, setDados] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .get("/company/dados")
      .then(({ data }) => setDados(data || {}))
      .catch(toastError);
  }, []);

  const salvar = async () => {
    setSalvando(true);
    try {
      const corpo = CAMPOS.reduce((acc, { chave }) => ({ ...acc, [chave]: dados[chave] || "" }), {});
      const { data } = await api.put("/company/dados", corpo);
      setDados(data || {});
      toast.success("Dados da empresa salvos.");
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Paper className={classes.paper} variant="outlined">
      <div>
        <Typography variant="subtitle1">Dados para documentos</Typography>
        <Typography variant="body2" color="text.secondary">
          Aparecem no cabeçalho da proposta, da ordem de produção e da cobrança.
        </Typography>
      </div>
      <div className={classes.grade}>
        {CAMPOS.map(({ chave, rotulo, inteiro }) => (
          <TextField
            key={chave}
            label={rotulo}
            size="small"
            variant="outlined"
            value={dados[chave] || ""}
            onChange={(e) => setDados((atual) => ({ ...atual, [chave]: e.target.value }))}
            style={inteiro ? { gridColumn: "1 / -1" } : undefined}
          />
        ))}
      </div>
      <Box>
        <ButtonWithSpinner variant="contained" color="primary" loading={salvando} onClick={salvar}>
          Salvar dados
        </ButtonWithSpinner>
      </Box>
    </Paper>
  );
};

export default DadosDaEmpresa;
