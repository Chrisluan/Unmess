import React, { useState, useEffect } from "react";

import makeStyles from "@mui/styles/makeStyles";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Typography from "@mui/material/Typography";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import usePermissions from "../../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  secao: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 0,
    padding: 16,
    marginBottom: 14,
  },

  tituloSecao: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
    marginBottom: 12,
  },

  grade: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },

  entrega: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },

  totais: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 14,
    alignItems: "end",
  },

  resultado: {
    padding: "8px 12px",
    borderRadius: 0,
    background: theme.palette.action.hover,
    fontVariantNumeric: "tabular-nums",
  },

  acoes: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 },
}));

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/** Data ISO do backend para o formato que o input[type=date] entende. */
const paraCampoData = (iso) => (iso ? String(iso).slice(0, 10) : "");
const paraCampoHora = (iso) => (iso ? String(iso).slice(11, 16) : "");

/**
 * Dados comerciais da proposta.
 *
 * O que se combina para fechar a venda: prazo, forma de pagamento, desconto e
 * como o cliente recebe. Antes isso vivia no WhatsApp e no papel — a ordem de
 * serviço saía sem metade da informação.
 */
const AbaProposta = ({ deal, onSalvo }) => {
  const classes = useStyles();
  const { can } = usePermissions();
  const podeEditar = can("crm:edit");

  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setForm({
      title: deal.title || "",
      dataEntrega: paraCampoData(deal.deliveryAt),
      horaEntrega: paraCampoHora(deal.deliveryAt),
      deliveryToArrange: Boolean(deal.deliveryToArrange),
      deliveryMode: deal.deliveryMode || "pickup",
      carrier: deal.carrier || "",
      paymentCondition: deal.paymentCondition || "",
      installments: deal.installments || 1,
      discount: deal.discount || 0,
      discountType: deal.discountType || "value",
      origin: deal.origin || "",
      notes: deal.notes || "",
    });
  }, [deal]);

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  // O valor do card é a soma dos itens; o desconto incide sobre ele e o
  // resultado é o que o cliente paga.
  const bruto = Number(deal.value || 0);
  const abatimento =
    form.discountType === "percent"
      ? (bruto * Number(form.discount || 0)) / 100
      : Number(form.discount || 0);
  const liquido = Math.max(0, bruto - abatimento);

  const salvar = async () => {
    setSalvando(true);
    try {
      // Data e hora são dois campos na tela e um só no banco: juntar aqui evita
      // uma coluna a mais só para guardar o horário.
      const deliveryAt =
        form.dataEntrega && !form.deliveryToArrange
          ? `${form.dataEntrega}T${form.horaEntrega || "00:00"}:00`
          : null;

      await api.put(`/deals/${deal.id}`, {
        title: form.title,
        deliveryAt,
        deliveryToArrange: form.deliveryToArrange,
        deliveryMode: form.deliveryMode,
        carrier: form.deliveryMode === "delivery" ? form.carrier : null,
        paymentCondition: form.paymentCondition,
        installments: Number(form.installments) || 1,
        discount: Number(form.discount) || 0,
        discountType: form.discountType,
        origin: form.origin,
        notes: form.notes,
      });

      if (onSalvo) await onSalvo();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className={classes.secao}>
        <div className={classes.tituloSecao}>Dados do orçamento</div>

        <div className={classes.grade}>
          <TextField
            label="Referência"
            size="small"
            variant="outlined"
            value={form.title || ""}
            disabled={!podeEditar}
            onChange={(e) => mudar("title", e.target.value)}
            style={{ gridColumn: "1 / -1" }}
          />

          <TextField
            label="Data de entrega"
            type="date"
            size="small"
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            value={form.dataEntrega || ""}
            disabled={!podeEditar || form.deliveryToArrange}
            onChange={(e) => mudar("dataEntrega", e.target.value)}
          />

          <TextField
            label="Hora de entrega"
            type="time"
            size="small"
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            value={form.horaEntrega || ""}
            disabled={!podeEditar || form.deliveryToArrange}
            onChange={(e) => mudar("horaEntrega", e.target.value)}
          />

          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={Boolean(form.deliveryToArrange)}
                disabled={!podeEditar}
                onChange={(e) => mudar("deliveryToArrange", e.target.checked)}
              />
            }
            label="A combinar"
          />

          <TextField
            label="Origem"
            size="small"
            variant="outlined"
            placeholder="Indicação, Instagram, balcão…"
            value={form.origin || ""}
            disabled={!podeEditar}
            onChange={(e) => mudar("origin", e.target.value)}
          />
        </div>
      </div>

      <div className={classes.secao}>
        <div className={classes.tituloSecao}>Entrega</div>

        <div className={classes.entrega}>
          <RadioGroup
            row
            value={form.deliveryMode || "pickup"}
            onChange={(e) => mudar("deliveryMode", e.target.value)}
          >
            <FormControlLabel
              value="pickup"
              control={<Radio size="small" disabled={!podeEditar} />}
              label="Retirada"
            />
            <FormControlLabel
              value="delivery"
              control={<Radio size="small" disabled={!podeEditar} />}
              label="Entrega"
            />
          </RadioGroup>

          {/* Transportadora só faz sentido quando há entrega; deixá-la sempre
              visível convida a preencher um dado que não será usado. */}
          {form.deliveryMode === "delivery" && (
            <TextField
              label="Transportadora"
              size="small"
              variant="outlined"
              value={form.carrier || ""}
              disabled={!podeEditar}
              onChange={(e) => mudar("carrier", e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
          )}
        </div>
      </div>

      <div className={classes.secao}>
        <div className={classes.tituloSecao}>Negociação</div>

        <div className={classes.totais}>
          <TextField
            label="Condição de pagamento"
            size="small"
            variant="outlined"
            placeholder="À vista, 30/60, PIX…"
            value={form.paymentCondition || ""}
            disabled={!podeEditar}
            onChange={(e) => mudar("paymentCondition", e.target.value)}
          />

          <TextField
            label="Nº de parcelas"
            type="number"
            size="small"
            variant="outlined"
            value={form.installments || 1}
            disabled={!podeEditar}
            onChange={(e) => mudar("installments", e.target.value)}
            inputProps={{ min: 1, max: 99 }}
          />

          <TextField
            select
            label="Desconto em"
            size="small"
            variant="outlined"
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            value={form.discountType || "value"}
            disabled={!podeEditar}
            onChange={(e) => mudar("discountType", e.target.value)}
          >
            <option value="value">R$</option>
            <option value="percent">%</option>
          </TextField>

          <TextField
            label="Desconto"
            type="number"
            size="small"
            variant="outlined"
            value={form.discount || 0}
            disabled={!podeEditar}
            onChange={(e) => mudar("discount", e.target.value)}
            inputProps={{ min: 0, step: "0.01" }}
          />
        </div>

        <div className={classes.totais} style={{ marginTop: 14 }}>
          <div>
            <Typography variant="caption" color="textSecondary">
              Valor dos itens
            </Typography>
            <div className={classes.resultado}>{moeda(bruto)}</div>
          </div>
          <div>
            <Typography variant="caption" color="textSecondary">
              Desconto
            </Typography>
            <div className={classes.resultado}>− {moeda(abatimento)}</div>
          </div>
          <div>
            <Typography variant="caption" color="textSecondary">
              Valor total
            </Typography>
            <div className={classes.resultado} style={{ fontWeight: 700 }}>
              {moeda(liquido)}
            </div>
          </div>
        </div>
      </div>

      <div className={classes.secao}>
        <div className={classes.tituloSecao}>Observações</div>
        <TextField
          fullWidth
          multiline
          rows={3}
          size="small"
          variant="outlined"
          placeholder="O que precisa ficar registrado sobre este orçamento"
          value={form.notes || ""}
          disabled={!podeEditar}
          onChange={(e) => mudar("notes", e.target.value)}
        />
      </div>

      {podeEditar && (
        <div className={classes.acoes}>
          <Button variant="contained" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar proposta"}
          </Button>
        </div>
      )}
    </>
  );
};

export default AbaProposta;
