import React, { useState, useEffect } from "react";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FORMAS = [
  { valor: "cash", texto: "Dinheiro" },
  { valor: "pix", texto: "Pix" },
  { valor: "debit", texto: "Cartão de débito" },
  { valor: "credit", texto: "Cartão de crédito" },
  { valor: "boleto", texto: "Boleto" },
  { valor: "transfer", texto: "Transferência" },
  { valor: "check", texto: "Cheque" },
  { valor: "other", texto: "Outro" },
];

/**
 * Baixa de uma parcela.
 *
 * O valor vem preenchido com o que falta, que é o caso de longe mais comum:
 * quem recebeu tudo confirma sem digitar nada. Editar o campo é o que permite
 * o recebimento parcial — e é a razão de a baixa ser um lançamento, e não um
 * campo "pago: sim" na parcela.
 *
 * A data é a do movimento, não a de hoje: um pagamento recebido no sábado e
 * lançado na segunda tem que aparecer no caixa do sábado.
 */
const BaixaModal = ({ open, receivable, contas, onClose, onBaixado }) => {
  const [valor, setValor] = useState("");
  const [contaId, setContaId] = useState("");
  const [forma, setForma] = useState("pix");
  const [data, setData] = useState("");
  const [salvando, setSalvando] = useState(false);

  const restante = receivable
    ? Number(
        (
          Number(receivable.amount || 0) - Number(receivable.paidAmount || 0)
        ).toFixed(2)
      )
    : 0;

  useEffect(() => {
    if (!open || !receivable) return;

    setValor(String(restante));
    setData(new Date().toISOString().slice(0, 10));

    // A primeira conta ativa já vem escolhida: quase toda empresa tem uma só,
    // e obrigar a escolher todo dia seria um clique sem decisão.
    const ativa = (contas || []).find((c) => c.active !== false);
    setContaId(ativa ? ativa.id : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, receivable]);

  const confirmar = async () => {
    setSalvando(true);
    try {
      await api.post(`/finance/receivables/${receivable.id}/receber`, {
        accountId: contaId,
        amount: Number(valor),
        occurredAt: data,
        method: forma,
      });
      if (onBaixado) await onBaixado();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const valorNumerico = Number(valor);
  const valido =
    contaId &&
    valorNumerico > 0 &&
    valorNumerico <= restante + 0.005 &&
    Boolean(data);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Dar baixa</DialogTitle>

      <DialogContent dividers>
        {receivable && (
          <>
            <Typography variant="body2" style={{ marginBottom: 4 }}>
              {receivable.description}
            </Typography>
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ display: "block", marginBottom: 16 }}
            >
              Parcela {receivable.installment}/{receivable.installments} · falta{" "}
              {moeda(restante)}
            </Typography>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <TextField
                size="small"
                type="number"
                label="Valor recebido"
                inputProps={{ step: "0.01", min: 0, max: restante }}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                helperText={
                  valorNumerico > restante + 0.005
                    ? "Maior que o saldo da parcela"
                    : valorNumerico > 0 && valorNumerico < restante
                    ? `Recebimento parcial — restam ${moeda(
                        restante - valorNumerico
                      )}`
                    : " "
                }
                error={valorNumerico > restante + 0.005}
                autoFocus
              />

              <TextField
                size="small"
                type="date"
                label="Data do recebimento"
                InputLabelProps={{ shrink: true }}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />

              <TextField
                select
                size="small"
                label="Conta"
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                helperText={
                  (contas || []).length === 0
                    ? "Cadastre uma conta na aba Configuração"
                    : " "
                }
              >
                {(contas || [])
                  .filter((c) => c.active !== false)
                  .map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Forma"
                value={forma}
                onChange={(e) => setForma(e.target.value)}
              >
                {FORMAS.map((f) => (
                  <MenuItem key={f.valor} value={f.valor}>
                    {f.texto}
                  </MenuItem>
                ))}
              </TextField>
            </div>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          onClick={confirmar}
          disabled={!valido || salvando}
          startIcon={salvando ? <CircularProgress size={14} /> : null}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BaixaModal;
