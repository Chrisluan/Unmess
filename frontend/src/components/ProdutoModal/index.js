import React, { useState, useEffect } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Autocomplete from "@mui/material/Autocomplete";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";
import { moeda, rotuloDaBase } from "../Crm/calculoItem";

const useStyles = makeStyles((theme) => ({
  corpo: { display: "flex", flexDirection: "column", gap: 14, paddingTop: 8 },
  linha: { display: "flex", gap: 12, flexWrap: "wrap" },

  ajuda: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: -6,
  },

  secao: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
    marginTop: 4,
  },

  margem: {
    padding: "8px 12px",
    borderRadius: 0,
    background: theme.palette.action.hover,
    fontSize: 13,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  margemBoa: { fontWeight: 700, color: theme.palette.success.main },
  margemBaixa: { fontWeight: 700, color: theme.palette.error.main },

  linhaComposicao: {
    display: "grid",
    gridTemplateColumns: "minmax(160px, 1fr) 110px 90px 32px",
    gap: 8,
    alignItems: "center",
  },
  custoLinha: { textAlign: "right", fontSize: 12.5, fontVariantNumeric: "tabular-nums" },

  linhaAcabamento: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 13,
  },
}));

const VAZIO = {
  name: "",
  code: "",
  category: "",
  unit: "un",
  pricingMode: "unit",
  priceMode: "manual",
  markupPercent: "",
  price: 0,
  cost: 0,
  minMeasure: 0,
  description: "",
};

const UNIDADE_DO_INSUMO = { m2: "m²", m: "m", un: "un", kg: "kg", l: "l", h: "h" };

/** A mesma conta de helpers/Precificacao no servidor. */
const precoPeloCusto = (custo, { modo, percentual }) => {
  const p = Math.max(0, Number(percentual) || 0);
  if (modo === "lucro") return p >= 100 ? null : custo / (1 - p / 100);
  return custo * (1 + p / 100);
};

/**
 * Cadastro de um produto do catálogo.
 *
 * O campo que mais muda o resultado é a forma de cobrança: ela decide se o
 * orçamento vai pedir medidas e como a conta é feita. Por isso vem junto com a
 * unidade e com uma explicação do que cada modo significa -- escolher errado
 * aqui só apareceria no orçamento do cliente.
 *
 * O preço pode ser digitado (manual) ou calculado: custo dos insumos que
 * entram em uma unidade de medida, vezes o markup. Calculado só aparece para
 * quem vê custo -- montar composição sem ver o custo dos insumos é às cegas.
 */
const ProdutoModal = ({ open, produto, onClose, onSalvo }) => {
  const classes = useStyles();
  const { can } = usePermissions();
  const verCusto = can("products:viewCost");

  const [form, setForm] = useState(VAZIO);
  const [composicao, setComposicao] = useState([]);
  const [oferecidos, setOferecidos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [regra, setRegra] = useState({ modo: "markup", percentual: 100 });
  const [acabamentos, setAcabamentos] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(
      produto
        ? {
            ...VAZIO,
            ...produto,
            markupPercent:
              produto.markupPercent === null || produto.markupPercent === undefined
                ? ""
                : produto.markupPercent,
          }
        : VAZIO
    );
    setComposicao(
      (produto?.composicao || []).map((c) => ({ supplyId: c.supplyId, quantity: c.quantity }))
    );
    setOferecidos(
      (produto?.acabamentos || []).map((a) => ({ finishId: a.finishId, isDefault: Boolean(a.isDefault) }))
    );

    api
      .get("/products/categories")
      .then(({ data }) => setCategorias(data.categories || []))
      .catch(() => {});
    api
      .get("/acabamentos", { params: { includeInactive: "true" } })
      .then(({ data }) => setAcabamentos(data.acabamentos || []))
      .catch(() => {});
    if (verCusto) {
      api
        .get("/insumos", { params: { includeInactive: "true" } })
        .then(({ data }) => {
          setInsumos(data.insumos || []);
          if (data.regra) setRegra(data.regra);
        })
        .catch(() => {});
    }
  }, [open, produto, verCusto]);

  const mudar = (campo, valor) => setForm((a) => ({ ...a, [campo]: valor }));

  const trocarModo = (modo) => {
    // A unidade acompanha a forma de cobrança: vender por m² e escrever "un" na
    // unidade sairia contraditório na ordem de serviço.
    const unidade = modo === "area" ? "m2" : modo === "linear" ? "m" : "un";
    setForm((a) => ({ ...a, pricingMode: modo, unit: unidade }));
  };

  const calculado = form.priceMode === "calculado";
  const insumoPorId = new Map(insumos.map((i) => [i.id, i]));
  const custoDaLinha = (linha) => {
    const insumo = insumoPorId.get(linha.supplyId);
    if (!insumo) return 0;
    return (
      (Number(linha.quantity) || 0) *
      (Number(insumo.cost) || 0) *
      (1 + (Number(insumo.wastePercent) || 0) / 100)
    );
  };
  const custoCalculado = composicao.reduce((s, l) => s + custoDaLinha(l), 0);
  const percentual =
    form.markupPercent === "" || form.markupPercent === null ? regra.percentual : form.markupPercent;
  const precoCalculado = precoPeloCusto(custoCalculado, { modo: regra.modo, percentual });

  const preco = calculado ? precoCalculado || 0 : Number(form.price) || 0;
  const custo = calculado ? custoCalculado : Number(form.cost) || 0;
  const margem = preco ? Number((((preco - custo) / preco) * 100).toFixed(1)) : null;

  const unidadeDeMedida =
    form.pricingMode === "area" ? "m²" : form.pricingMode === "linear" ? "metro" : "peça";

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
        markupPercent: form.markupPercent === "" ? null : Number(form.markupPercent),
        acabamentos: oferecidos,
      };
      delete dados.composicao;
      // Quem não vê custo recebeu null no lugar dele; mandar 0 apagaria o
      // custo de verdade.
      if (!verCusto) delete dados.cost;
      // Composição só vai quando quem salva a enxerga: quem não vê custo não
      // carregou os insumos, e mandar a lista vazia apagaria a de verdade.
      if (verCusto) {
        dados.composicao = composicao
          .filter((l) => l.supplyId && Number(l.quantity) > 0)
          .map((l) => ({ supplyId: l.supplyId, quantity: Number(l.quantity) }));
      }

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

  const insumosAtivos = insumos.filter((i) => i.active !== false);
  const acabamentoPorId = new Map(acabamentos.map((a) => [a.id, a]));
  const acabamentosDisponiveis = acabamentos.filter(
    (a) => a.active !== false && !oferecidos.some((o) => o.finishId === a.id)
  );

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
              style={{ flex: 1, minWidth: 140 }}
              value={form.code || ""}
              onChange={(e) => mudar("code", e.target.value)}
            />

            <TextField
              label="Categoria"
              size="small"
              variant="outlined"
              style={{ flex: 1, minWidth: 140 }}
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
              style={{ flex: 1, minWidth: 180 }}
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

          {verCusto && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={form.priceMode}
              onChange={(_e, v) => v && mudar("priceMode", v)}
            >
              <ToggleButton value="manual">Preço digitado</ToggleButton>
              <ToggleButton value="calculado">Calculado pelo custo</ToggleButton>
            </ToggleButtonGroup>
          )}

          {calculado ? (
            <>
              <span className={classes.secao}>
                Composição — o que vai em 1 {unidadeDeMedida}
              </span>
              {composicao.map((linha, i) => {
                const insumo = insumoPorId.get(linha.supplyId);
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <div className={classes.linhaComposicao} key={i}>
                    <Autocomplete
                      size="small"
                      options={insumosAtivos}
                      value={insumo || null}
                      getOptionLabel={(o) =>
                        `${o.name}${o.active === false ? " (desativado)" : ""}`
                      }
                      isOptionEqualToValue={(o, v) => o.id === v.id}
                      onChange={(_e, v) =>
                        setComposicao((atual) =>
                          atual.map((l, j) => (j === i ? { ...l, supplyId: v ? v.id : null } : l))
                        )
                      }
                      renderInput={(params) => (
                        <TextField {...params} variant="standard" placeholder="Insumo" />
                      )}
                    />
                    <TextField
                      size="small"
                      variant="standard"
                      type="number"
                      value={linha.quantity}
                      onChange={(e) =>
                        setComposicao((atual) =>
                          atual.map((l, j) => (j === i ? { ...l, quantity: e.target.value } : l))
                        )
                      }
                      inputProps={{ min: 0, step: "0.0001", inputMode: "decimal" }}
                      InputProps={{
                        endAdornment: insumo ? (
                          <span style={{ fontSize: 11, opacity: 0.7 }}>
                            {UNIDADE_DO_INSUMO[insumo.unit] || insumo.unit}
                          </span>
                        ) : null,
                      }}
                    />
                    <span className={classes.custoLinha}>{moeda(custoDaLinha(linha))}</span>
                    <IconButton
                      size="small"
                      aria-label="Remover insumo"
                      onClick={() => setComposicao((atual) => atual.filter((_l, j) => j !== i))}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </div>
                );
              })}
              <div>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setComposicao((atual) => [...atual, { supplyId: null, quantity: 1 }])}
                  disabled={insumosAtivos.length === 0}
                >
                  Insumo
                </Button>
                {insumosAtivos.length === 0 && (
                  <span className={classes.ajuda} style={{ marginLeft: 8 }}>
                    Cadastre os insumos na aba Insumos desta tela.
                  </span>
                )}
              </div>

              <div className={classes.linha}>
                <TextField
                  label={regra.modo === "lucro" ? "Lucro próprio (%)" : "Markup próprio (%)"}
                  type="number"
                  size="small"
                  variant="outlined"
                  style={{ width: 190 }}
                  value={form.markupPercent}
                  onChange={(e) => mudar("markupPercent", e.target.value)}
                  placeholder={`Empresa: ${regra.percentual}%`}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: 0, step: "0.1" }}
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
              <span className={classes.ajuda}>
                Vazio usa o percentual da empresa (Ajustes ›{" "}
                {regra.modo === "lucro" ? "lucro sobre a venda" : "markup sobre o custo"}). O
                preço é refeito sozinho quando o custo de um insumo muda.
              </span>

              <div className={classes.margem}>
                <span>Custo por {unidadeDeMedida}: {moeda(custoCalculado)}</span>
                <span>
                  Preço: <strong>{precoCalculado === null ? "—" : moeda(precoCalculado)}</strong>
                </span>
                {margem !== null && (
                  <span className={margem < 20 ? classes.margemBaixa : classes.margemBoa}>
                    margem {margem}%
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
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
                  style={{ flex: 1, minWidth: 120 }}
                  value={form.price}
                  onChange={(e) => mudar("price", e.target.value)}
                  inputProps={{ min: 0, step: "0.01" }}
                />

                {verCusto && (
                  <TextField
                    label="Custo"
                    type="number"
                    size="small"
                    variant="outlined"
                    style={{ flex: 1, minWidth: 120 }}
                    value={form.cost ?? ""}
                    onChange={(e) => mudar("cost", e.target.value)}
                    inputProps={{ min: 0, step: "0.01" }}
                  />
                )}

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

              {verCusto && custo > 0 && preco > 0 && (
                <div className={classes.margem}>
                  <span>Margem</span>
                  <span className={margem < 20 ? classes.margemBaixa : classes.margemBoa}>
                    {margem}%
                  </span>
                </div>
              )}
            </>
          )}

          {form.pricingMode !== "unit" && (
            <span className={classes.ajuda}>
              Mínimo cobrado por peça. Sem ele, uma peça pequena sai por
              centavos, ainda que dê o mesmo trabalho de preparar.
            </span>
          )}

          <span className={classes.secao}>Acabamentos oferecidos</span>
          {oferecidos.map((o) => {
            const a = acabamentoPorId.get(o.finishId);
            return (
              <div className={classes.linhaAcabamento} key={o.finishId}>
                <Checkbox
                  size="small"
                  checked={o.isDefault}
                  onChange={(e) =>
                    setOferecidos((atual) =>
                      atual.map((x) =>
                        x.finishId === o.finishId ? { ...x, isDefault: e.target.checked } : x
                      )
                    )
                  }
                  inputProps={{ "aria-label": "Já vem marcado no orçamento" }}
                />
                <span style={{ flex: 1 }}>
                  {a ? a.name : `#${o.finishId}`}
                  <span className={classes.ajuda} style={{ marginLeft: 6 }}>
                    {a ? rotuloDaBase(a.base) : ""}
                    {o.isDefault ? " · já vem marcado" : ""}
                  </span>
                </span>
                <IconButton
                  size="small"
                  aria-label="Remover acabamento"
                  onClick={() => setOferecidos((atual) => atual.filter((x) => x.finishId !== o.finishId))}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </div>
            );
          })}
          {acabamentosDisponiveis.length > 0 ? (
            <Autocomplete
              size="small"
              options={acabamentosDisponiveis}
              value={null}
              blurOnSelect
              getOptionLabel={(a) => a.name}
              onChange={(_e, a) =>
                a && setOferecidos((atual) => [...atual, { finishId: a.id, isDefault: false }])
              }
              renderInput={(params) => (
                <TextField {...params} variant="standard" placeholder="+ Acabamento" />
              )}
              style={{ maxWidth: 320 }}
            />
          ) : (
            acabamentos.length === 0 && (
              <span className={classes.ajuda} style={{ marginTop: 0 }}>
                Nenhum acabamento cadastrado (aba Acabamentos desta tela).
              </span>
            )
          )}
          <span className={classes.ajuda}>
            Marcados entram sozinhos no item ao escolher o produto; os demais
            ficam à mão na lista do item.
          </span>

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
