import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";

/**
 * Próximo vencimento a partir do dia cadastrado.
 *
 * O mesmo cálculo do servidor, repetido aqui só para o campo já abrir
 * preenchido: quem emite quer conferir a data, não digitá-la. O valor que
 * vale continua sendo o do backend quando o campo vem vazio.
 */
const proximoVencimento = (dia) => {
  const hoje = new Date();
  const seguro = Math.min(Math.max(Number(dia) || 10, 1), 28);
  let alvo = new Date(hoje.getFullYear(), hoje.getMonth(), seguro);
  if (alvo <= hoje) {
    alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, seguro);
  }
  return alvo.toISOString().slice(0, 10);
};

const competencia = (iso) => {
  const [ano, mes] = String(iso).split("-");
  return `${mes}/${ano}`;
};

/**
 * Emissão de uma cobrança.
 *
 * Quando há gateway configurado, o modal ainda oferece o modo manual: acontece
 * de a cobrança já ter saído no banco, ou de o cliente pedir um boleto avulso
 * emitido por fora. Sem esse escape, registrar o que existe no mundo real
 * exigiria emitir uma segunda cobrança de mentira.
 */
const EmitirFaturaModal = ({
  open,
  company,
  emissaoAutomatica,
  onClose,
  onEmitida,
}) => {
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!open) return;
    const vencimento = proximoVencimento(company.billingDay);
    setForm({
      amount: company.monthlyFee || "",
      dueDate: vencimento,
      description: `Mensalidade ${competencia(vencimento)}`,
      billingType: "boleto",
      manual: !emissaoAutomatica,
      digitableLine: "",
      bankSlipUrl: "",
      notes: "",
    });
  }, [open, company, emissaoAutomatica]);

  const mudar = (campo) => (e) =>
    setForm((atual) => ({
      ...atual,
      [campo]:
        e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const emitir = async () => {
    setEnviando(true);
    try {
      await api.post(`/companies/${company.id}/invoices`, form);
      toast.success(
        form.manual ? "Cobrança registrada." : "Cobrança emitida no gateway."
      );
      onEmitida?.();
    } catch (err) {
      toastError(err);
    } finally {
      setEnviando(false);
    }
  };

  if (!form) return null;

  const semDocumento = !company.document;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {form.manual ? "Registrar cobrança" : "Emitir cobrança"} —{" "}
        {company.name}
      </DialogTitle>

      <DialogContent dividers>
        {!form.manual && semDocumento && (
          <Alert severity="warning" style={{ marginBottom: 16 }}>
            Esta empresa está sem CNPJ/CPF. O gateway recusa a cobrança sem o
            documento — preencha na aba Visão geral antes de emitir.
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              variant="outlined"
              label="Descrição"
              value={form.description}
              onChange={mudar("description")}
              helperText="Aparece para o cliente no boleto."
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              type="number"
              variant="outlined"
              label="Valor (R$)"
              value={form.amount}
              onChange={mudar("amount")}
              inputProps={{ min: 0, step: "0.01" }}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              type="date"
              variant="outlined"
              label="Vencimento"
              InputLabelProps={{ shrink: true }}
              value={form.dueDate}
              onChange={mudar("dueDate")}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              size="small"
              variant="outlined"
              label="Forma"
              value={form.billingType}
              onChange={mudar("billingType")}
              disabled={form.manual}
            >
              <MenuItem value="boleto">Boleto</MenuItem>
              <MenuItem value="pix">Pix</MenuItem>
            </TextField>
          </Grid>

          {emissaoAutomatica && (
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={form.manual}
                    onChange={mudar("manual")}
                  />
                }
                label="Só registrar (o boleto já foi emitido no banco)"
              />
            </Grid>
          )}

          {form.manual && (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Linha digitável"
                  value={form.digitableLine}
                  onChange={mudar("digitableLine")}
                  helperText="Opcional. Cole aqui para o suporte reenviar sem procurar no banco."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Link do boleto (PDF)"
                  value={form.bankSlipUrl}
                  onChange={mudar("bankSlipUrl")}
                  helperText="Opcional."
                />
              </Grid>
            </>
          )}

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              variant="outlined"
              label="Observações internas"
              value={form.notes}
              onChange={mudar("notes")}
              helperText="Só o super vê."
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancelar
        </Button>
        <ButtonWithSpinner
          variant="contained"
          color="primary"
          loading={enviando}
          disabled={!form.amount || !form.dueDate}
          onClick={emitir}
        >
          {form.manual ? "Registrar" : "Emitir no gateway"}
        </ButtonWithSpinner>
      </DialogActions>
    </Dialog>
  );
};

export default EmitirFaturaModal;
