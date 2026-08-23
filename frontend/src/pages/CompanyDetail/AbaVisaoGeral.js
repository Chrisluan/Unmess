import React, { useState } from "react";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";

const useStyles = makeStyles((theme) => ({
  secao: {
    marginBottom: theme.spacing(3),
  },

  tituloSecao: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },

  apoio: {
    color: theme.palette.text.secondary,
    display: "block",
    marginTop: 2,
  },

  rodape: {
    display: "flex",
    justifyContent: "flex-end",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

const PLANOS = [
  { valor: "basic", rotulo: "Básico" },
  { valor: "pro", rotulo: "Profissional" },
  { valor: "enterprise", rotulo: "Enterprise" },
];

/**
 * Cadastro e regras de cobrança da empresa.
 *
 * A situação de acesso não está aqui de propósito: bloquear e liberar tem
 * consequência — encerra as sessões abertas, grava motivo e data — e mora na
 * aba Acesso, com a confirmação que uma decisão dessas merece. Misturada num
 * formulário de cadastro, ela sairia junto com um salvamento distraído.
 */
const AbaVisaoGeral = ({ company, onSalvo }) => {
  const classes = useStyles();
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    name: company.name || "",
    document: company.document || "",
    email: company.email || "",
    phone: company.phone || "",
    plan: company.plan || "basic",
    monthlyFee: company.monthlyFee ?? 0,
    billingDay: company.billingDay ?? 10,
    blockWhenOverdue: Boolean(company.blockWhenOverdue),
    overdueGraceDays: company.overdueGraceDays ?? 5,
  });

  const mudar = (campo) => (e) =>
    setForm((atual) => ({
      ...atual,
      [campo]:
        e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put(`/companies/${company.id}`, {
        ...form,
        monthlyFee: Number(form.monthlyFee) || 0,
        billingDay: Number(form.billingDay) || 10,
        overdueGraceDays: Number(form.overdueGraceDays) || 0,
      });
      toast.success("Empresa atualizada.");
      onSalvo?.();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className={classes.secao}>
        <Typography component="h2" className={classes.tituloSecao}>
          Dados da empresa
        </Typography>
        <Divider />

        <Grid container spacing={2} style={{ marginTop: 4 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              label="Nome"
              value={form.name}
              onChange={mudar("name")}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              label="CNPJ / CPF"
              value={form.document}
              onChange={mudar("document")}
              helperText="Usado no boleto. Sem ele o gateway recusa a cobrança."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              label="E-mail de cobrança"
              value={form.email}
              onChange={mudar("email")}
              helperText="Para onde o gateway manda o boleto."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              label="Telefone"
              value={form.phone}
              onChange={mudar("phone")}
            />
          </Grid>
        </Grid>
      </div>

      <div className={classes.secao}>
        <Typography component="h2" className={classes.tituloSecao}>
          Plano e mensalidade
        </Typography>
        <Divider />

        <Grid container spacing={2} style={{ marginTop: 4 }}>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              size="small"
              variant="outlined"
              label="Plano"
              value={form.plan}
              onChange={mudar("plan")}
            >
              {PLANOS.map((p) => (
                <MenuItem key={p.valor} value={p.valor}>
                  {p.rotulo}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              type="number"
              variant="outlined"
              label="Mensalidade (R$)"
              value={form.monthlyFee}
              onChange={mudar("monthlyFee")}
              inputProps={{ min: 0, step: "0.01" }}
              helperText="Valor sugerido ao emitir uma cobrança."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              type="number"
              variant="outlined"
              label="Dia do vencimento"
              value={form.billingDay}
              onChange={mudar("billingDay")}
              inputProps={{ min: 1, max: 28 }}
              helperText="Até 28, para existir em todo mês."
            />
          </Grid>
        </Grid>
      </div>

      <div className={classes.secao}>
        <Typography component="h2" className={classes.tituloSecao}>
          Inadimplência
        </Typography>
        <Divider />

        <FormControlLabel
          style={{ marginTop: 8 }}
          control={
            <Switch
              color="primary"
              checked={form.blockWhenOverdue}
              onChange={mudar("blockWhenOverdue")}
            />
          }
          label="Suspender o acesso automaticamente quando houver fatura vencida"
        />
        <Typography variant="caption" className={classes.apoio}>
          O servidor verifica de hora em hora. Quando a última fatura vencida é
          paga ou cancelada, o acesso volta sozinho — desde que a suspensão
          tenha sido feita por este motivo.
        </Typography>

        {form.blockWhenOverdue && (
          <TextField
            style={{ marginTop: 12, maxWidth: 260 }}
            fullWidth
            size="small"
            type="number"
            variant="outlined"
            label="Dias de tolerância"
            value={form.overdueGraceDays}
            onChange={mudar("overdueGraceDays")}
            inputProps={{ min: 0, max: 90 }}
            helperText="Quantos dias após o vencimento antes de cortar."
          />
        )}
      </div>

      <div className={classes.rodape}>
        <ButtonWithSpinner
          variant="contained"
          color="primary"
          loading={salvando}
          onClick={salvar}
        >
          Salvar alterações
        </ButtonWithSpinner>
      </div>
    </>
  );
};

export default AbaVisaoGeral;
