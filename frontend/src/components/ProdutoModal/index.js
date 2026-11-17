import React, { useState, useEffect } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  corpo: { display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 },
  linha: { display: "flex", gap: 12 },

  ajuda: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: -6,
  },

  margem: {
    padding: "8px 12px",
    borderRadius: 0,
    background: theme.palette.action.hover,
    fontSize: 13,
    display: "flex",
    justifyContent: "space-between",
  },

  margemBoa: { fontWeight: 700, color: theme.palette.success.main },
  margemBaixa: { fontWeight: 700, color: theme.palette.error.main },
}));

const VAZIO = {
  name: "",
  code: "",
  category: "",
  unit: "un",
  pricingMode: "unit",
  price: 0,
  cost: 0,
  minMeasure: 0,
  description: "",
};

/**
 * Cadastro de um produto do catálogo.
 *
 * O campo que mais muda o resultado é a forma de cobrança: ela decide se o
 * orçamento vai pedir medidas e como a conta é feita. Por isso vem junto com a
 * unidade e com uma explicação do que cada modo significa -- escolher errado
 * aqui só apareceria no orçamento do cliente.
 */
const ProdutoModal = ({ open, produto, onClose, onSalvo }) => {
  const classes = useStyles();

  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(produto ? { ...VAZIO, ...produto } : VAZIO);

    api
      .get("/products/categories")
      .then(({ data }) => setCategorias(data.categories || []))
      .catch(() => {});
  }, [open, produto]);

  const mudar = (campo, valor) => setForm((a) => ({ ...a, [campo]: valor }));

  const trocarModo = (modo) => {
    // A unidade acompanha a forma de cobrança: vender por m² e escrever "un" na
    // unidade sairia contraditório na ordem de serviço.
    const unidade = modo === "area" ? "m2" : modo === "linear" ? "m" : "un";
    setForm((a) => ({ ...a, pricingMode: modo, unit: unidade }));
  };

  const preco = Number(form.price) || 0;
  const custo = Number(form.cost) || 0;
  const margem = preco ? Number((((preco - custo) / preco) * 100).toFixed(1)) : null;

  const salvar = async () => {
    if (!form.name?.trim()) return;

    setSalvando(true);
    try {
      const dados = {
        ...form,
        name: form.name.trim(),
        price: Number(form.price) || 0,
        cost: Number(form.cost) || 0,
        minMeasure: Number(form.minMeasure) || 0,
      };

      if (produto?.id) await api.put(`/products/${produto.id}`, dados);
      else await api.post("/products", dados);

      if (onSalvo) await onSalvo();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{produto ? "Editar produto" : "Novo produto"}</DialogTitle>

      <DialogContent>
        <div className={classes.corpo}>
          <TextField
            label="Nome"
            size="small"
            variant="outlined"
            autoFocus
            value={form.name}
            onChange={(e) => mudar("name", e.target.value)}
            placeholder="Adesivo impressão digital brilho"
          />

          <div className={classes.linha}>
            <TextField
              label="Código"
              size="small"
              variant="outlined"
              fullWidth
              value={form.code || ""}
              onChange={(e) => mudar("code", e.target.value)}
            />

            <TextField
              label="Categoria"
              size="small"
              variant="outlined"
              fullWidth
              value={form.category || ""}
              onChange={(e) => mudar("category", e.target.value)}
              // As categorias já usadas viram sugestão: sem isso nascem
              // "Adesivo", "Adesivos" e "adesivo" como três coisas diferentes.
              inputProps={{ list: "categorias-produto" }}
            />
            <datalist id="categorias-produto">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className={classes.linha}>
            <TextField
              select
              label="Forma de cobrança"
              size="small"
              variant="outlined"
              fullWidth
              SelectProps={{ native: true }}
              value={form.pricingMode}
              onChange={(e) => trocarModo(e.target.value)}
            >
              <option value="unit">Por unidade</option>
              <option value="area">Por metro quadrado</option>
              <option value="linear">Por metro linear</option>
            </TextField>

            <TextField
              label="Unidade"
              size="small"
              variant="outlined"
              style={{ width: 110 }}
              value={form.unit}
              onChange={(e) => mudar("unit", e.target.value)}
            />
          </div>

          <span className={classes.ajuda}>
            {form.pricingMode === "area"
              ? "O orçamento pedirá largura e altura, e multiplicará a área pelo preço."
              : form.pricingMode === "linear"
              ? "O orçamento pedirá o comprimento, e multiplicará pelo preço do metro."
              : "O orçamento multiplicará a quantidade de peças pelo preço."}
          </span>

          <div className={classes.linha}>
            <TextField
              label={
                form.pricingMode === "area"
                  ? "Preço por m²"
                  : form.pricingMode === "linear"
                  ? "Preço por metro"
                  : "Preço por peça"
              }
              type="number"
              size="small"
              variant="outlined"
              fullWidth
              value={form.price}
              onChange={(e) => mudar("price", e.target.value)}
              inputProps={{ min: 0, step: "0.01" }}
            />

            <TextField
              label="Custo"
              type="number"
              size="small"
              variant="outlined"
              fullWidth
              value={form.cost}
              onChange={(e) => mudar("cost", e.target.value)}
              inputProps={{ min: 0, step: "0.01" }}
            />

            {form.pricingMode !== "unit" && (
              <TextField
                label={form.pricingMode === "area" ? "Mín. (m²)" : "Mín. (m)"}
                type="number"
                size="small"
                variant="outlined"
                style={{ width: 120 }}
                value={form.minMeasure}
                onChange={(e) => mudar("minMeasure", e.target.value)}
                inputProps={{ min: 0, step: "0.001" }}
              />
            )}
          </div>

          {form.pricingMode !== "unit" && (
            <span className={classes.ajuda}>
              Mínimo cobrado por peça. Sem ele, uma peça pequena sai por
              centavos, ainda que dê o mesmo trabalho de preparar.
            </span>
          )}

          {custo > 0 && preco > 0 && (
            <div className={classes.margem}>
              <span>Margem</span>
              <span className={margem < 20 ? classes.margemBaixa : classes.margemBoa}>
                {margem}%
              </span>
            </div>
          )}

          <TextField
            label="Descrição"
            size="small"
            variant="outlined"
            multiline
            rows={2}
            value={form.description || ""}
            onChange={(e) => mudar("description", e.target.value)}
            placeholder="Detalhes que ajudam na produção"
          />
        </div>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={salvar}
          disabled={salvando || !form.name?.trim()}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProdutoModal;
