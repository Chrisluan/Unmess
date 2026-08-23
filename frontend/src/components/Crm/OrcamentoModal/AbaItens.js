import React, { useState, useEffect } from "react";

import makeStyles from "@mui/styles/makeStyles";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import PrintIcon from "@mui/icons-material/Print";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import usePermissions from "../../../hooks/usePermissions";
import abrirOrdemDeServico from "../../../helpers/ordemDeServico";
import SeletorProduto from "../SeletorProduto";

const useStyles = makeStyles((theme) => ({
  barra: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
  },

  cabecalho: {
    display: "grid",
    gridTemplateColumns: "1fr 92px 74px 58px 104px 96px 104px 34px",
    gap: 8,
    padding: "0 4px 6px",
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },

  linha: {
    display: "grid",
    gridTemplateColumns: "1fr 92px 74px 58px 104px 96px 104px 34px",
    gap: 8,
    alignItems: "center",
    padding: "5px 4px",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  // Segunda linha, recuada: as medidas pertencem ao item de cima e nao
  // podem competir com ele por atencao.
  medidas: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "2px 4px 8px 12px",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  resultadoMedida: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    fontVariantNumeric: "tabular-nums",
  },

  avisoMinimo: {
    fontSize: 11,
    fontWeight: 700,
    color: theme.palette.warning.main,
  },

  total: {
    textAlign: "right",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    fontSize: 13.5,
    paddingRight: 6,
  },

  rodape: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTop: `2px solid ${theme.palette.divider}`,
  },

  somaFinal: { fontSize: 19, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  vazio: { padding: "26px 0", textAlign: "center" },
}));

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/**
 * Mesmo cálculo do backend, para a linha somar enquanto se digita.
 *
 * A conta que vale é a do servidor; esta existe só para a tela responder na
 * hora. Por isso é uma tradução fiel de helpers/CalcularItem -- se as duas
 * divergirem, o total muda ao salvar e ninguém entende por quê.
 */
const calcularLinha = (item) => {
  const modo = item.pricingMode || "unit";
  const pecas = Number(item.quantity) || 0;
  const preco = Number(item.unitPrice) || 0;
  const desconto = Number(item.discount) || 0;
  const minimo = Number(item.minMeasure) || 0;
  const largura = Number(item.width) || 0;
  const altura = Number(item.height) || 0;

  let medida;
  if (modo === "area") medida = largura * altura;
  else if (modo === "linear") medida = largura;
  else medida = 1;

  // O mínimo vale por peça: dez adesivos pequenos custam dez mínimos.
  const cobrada = modo !== "unit" && minimo > 0 && medida > 0 && medida < minimo ? minimo : medida;
  const bruto = modo === "unit" ? pecas * preco : cobrada * pecas * preco;

  return {
    medida: Number(medida.toFixed(3)),
    total: Math.max(0, bruto - desconto),
    aplicouMinimo: modo !== "unit" && minimo > 0 && medida > 0 && medida < minimo,
  };
};

const totalDaLinha = (item) => calcularLinha(item).total;

/**
 * Itens do orçamento.
 *
 * A lista inteira é salva de uma vez, como o backend espera: editar várias
 * linhas e mandar uma chamada por linha deixaria o pedido pela metade se a
 * conexão caísse no meio.
 */
const AbaItens = ({ deal, onSalvo }) => {
  const classes = useStyles();
  const { can } = usePermissions();
  const podeEditar = can("crm:edit");

  const [itens, setItens] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setItens(
      (deal.items || []).map((i) => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unit: i.unit || "un",
        unitPrice: i.unitPrice,
        discount: i.discount || 0,
        productId: i.productId || null,
        width: i.width || 0,
        height: i.height || 0,
        pricingMode: i.pricingMode || "unit",
        minMeasure: i.minMeasure || 0,
      }))
    );
  }, [deal]);

  const mudar = (indice, campo, valor) =>
    setItens((atual) =>
      atual.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item))
    );

  /**
   * Produto escolhido preenche a linha.
   *
   * O preço é copiado, e não referenciado: o que o cliente aprova é o valor
   * daquele dia, e um reajuste no catálogo não pode reescrever orçamento já
   * fechado. O productId fica guardado só para saber o que foi vendido.
   */
  const escolherProduto = (indice, produto) =>
    setItens((atual) =>
      atual.map((item, i) =>
        i === indice
          ? {
              ...item,
              productId: produto.id,
              description: produto.name,
              unit: produto.unit || "un",
              unitPrice: produto.price,
              pricingMode: produto.pricingMode || "unit",
              minMeasure: produto.minMeasure || 0,
            }
          : item
      )
    );

  const adicionar = () =>
    setItens((atual) => [
      ...atual,
      {
        description: "",
        quantity: 1,
        unit: "un",
        unitPrice: 0,
        discount: 0,
        pricingMode: "unit",
        minMeasure: 0,
        width: 0,
        height: 0,
      },
    ]);

  const remover = (indice) =>
    setItens((atual) => atual.filter((_, i) => i !== indice));

  const soma = itens.reduce((s, i) => s + totalDaLinha(i), 0);

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put(`/deals/${deal.id}/items`, {
        items: itens.filter((i) => i.description?.trim()),
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
      <div className={classes.barra}>
        <Button
          size="small"
          startIcon={<PrintIcon />}
          onClick={() => abrirOrdemDeServico(deal.id).catch(toastError)}
        >
          Ordem de serviço
        </Button>
        {podeEditar && (
          <Button size="small" startIcon={<AddIcon />} onClick={adicionar}>
            Novo item
          </Button>
        )}
      </div>

      {itens.length === 0 ? (
        <div className={classes.vazio}>
          <Typography variant="body2" color="textSecondary">
            Nenhum item neste orçamento. Adicione o que será cobrado.
          </Typography>
        </div>
      ) : (
        <>
          <div className={classes.cabecalho}>
            <span>Descrição</span>
            <span>Cobrança</span>
            <span>Qtd.</span>
            <span>Un.</span>
            <span>Unitário</span>
            <span>Desconto</span>
            <span style={{ textAlign: "right" }}>Total</span>
            <span />
          </div>

          {itens.map((item, i) => (
            <React.Fragment key={item.id || `novo-${i}`}>
            <div className={classes.linha}>
              <SeletorProduto
                valor={item.description}
                disabled={!podeEditar}
                onChange={(v) => mudar(i, "description", v)}
                onEscolherProduto={(produto) => escolherProduto(i, produto)}
              />
              <TextField
                select
                size="small"
                variant="standard"
                value={item.pricingMode || "unit"}
                disabled={!podeEditar}
                onChange={(e) => mudar(i, "pricingMode", e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="unit">Unidade</option>
                <option value="area">m²</option>
                <option value="linear">Metro</option>
              </TextField>
              <TextField
                size="small"
                variant="standard"
                type="number"
                value={item.quantity}
                disabled={!podeEditar}
                onChange={(e) => mudar(i, "quantity", e.target.value)}
                inputProps={{ min: 0, step: "0.001" }}
              />
              <TextField
                size="small"
                variant="standard"
                value={item.unit}
                disabled={!podeEditar}
                onChange={(e) => mudar(i, "unit", e.target.value)}
              />
              <TextField
                size="small"
                variant="standard"
                type="number"
                value={item.unitPrice}
                disabled={!podeEditar}
                onChange={(e) => mudar(i, "unitPrice", e.target.value)}
                inputProps={{ min: 0, step: "0.01" }}
              />
              <TextField
                size="small"
                variant="standard"
                type="number"
                value={item.discount}
                disabled={!podeEditar}
                onChange={(e) => mudar(i, "discount", e.target.value)}
                inputProps={{ min: 0, step: "0.01" }}
              />
              <span className={classes.total}>{moeda(totalDaLinha(item))}</span>
              {podeEditar ? (
                <IconButton size="small" onClick={() => remover(i)} title="Remover">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              ) : (
                <span />
              )}
            </div>

            {/* Medidas só aparecem quando a cobrança as usa: pedir largura de
                uma letra caixa vendida por peça seria campo morto na tela. */}
            {item.pricingMode !== "unit" && (
              <div className={classes.medidas}>
                <TextField
                  size="small"
                  variant="standard"
                  type="number"
                  label={item.pricingMode === "linear" ? "Comprimento (m)" : "Largura (m)"}
                  InputLabelProps={{ shrink: true }}
                  value={item.width || 0}
                  disabled={!podeEditar}
                  onChange={(e) => mudar(i, "width", e.target.value)}
                  inputProps={{ min: 0, step: "0.001" }}
                  style={{ width: 130 }}
                />

                {item.pricingMode === "area" && (
                  <TextField
                    size="small"
                    variant="standard"
                    type="number"
                    label="Altura (m)"
                    InputLabelProps={{ shrink: true }}
                    value={item.height || 0}
                    disabled={!podeEditar}
                    onChange={(e) => mudar(i, "height", e.target.value)}
                    inputProps={{ min: 0, step: "0.001" }}
                    style={{ width: 110 }}
                  />
                )}

                <TextField
                  size="small"
                  variant="standard"
                  type="number"
                  label="Mínimo"
                  InputLabelProps={{ shrink: true }}
                  value={item.minMeasure || 0}
                  disabled={!podeEditar}
                  onChange={(e) => mudar(i, "minMeasure", e.target.value)}
                  inputProps={{ min: 0, step: "0.001" }}
                  style={{ width: 90 }}
                />

                <span className={classes.resultadoMedida}>
                  {item.pricingMode === "area"
                    ? `${calcularLinha(item).medida.toLocaleString("pt-BR")} m² por peça`
                    : `${calcularLinha(item).medida.toLocaleString("pt-BR")} m por peça`}
                </span>

                {calcularLinha(item).aplicouMinimo && (
                  <span className={classes.avisoMinimo}>
                    cobrando o mínimo
                  </span>
                )}
              </div>
            )}
            </React.Fragment>
          ))}
        </>
      )}

      <div className={classes.rodape}>
        <Typography variant="body2" color="textSecondary">
          {itens.length} {itens.length === 1 ? "item" : "itens"}
        </Typography>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className={classes.somaFinal}>{moeda(soma)}</span>
          {podeEditar && (
            <Button variant="contained" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar itens"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default AbaItens;
